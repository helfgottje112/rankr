import { chromium } from "playwright";
import { lookup as whoisLookup } from "whois";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const SOCIAL_RE = /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com|pinterest\.com/i;
const GENERIC_PREFIXES = new Set(["info", "hello", "sales", "support", "admin", "office", "contact", "enquiries", "enquiry", "inquiries", "webmaster", "postmaster"]);
const REDACTED_WORDS = ["privacy", "whoisprivacy", "redacted", "proxy", "protection", "@namecheap", "@godaddy", "@enom", "@registrar", "@markmonitor", "@whoisguard", "@domainsbyproxy"];

const OWNER_KEYWORDS = /(owner|founder|proprietor|principal|president|director|general manager|managing partner|proprietary)/i;

const CANDIDATE_PAGES = [
  "",
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/aboutus",
  "/team",
  "/our-team",
  "/privacy-policy",
  "/privacy",
  "/terms",
  "/impressum",
];

const OWNER_EXTRACT_SCRIPT = `() => {
  const text = (document.body && document.body.innerText) || "";
  const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi) || [])));
  const phones = Array.from(new Set((text.match(/(?:\\+?1[-.\\s]?)?(?:\\(?\\d{3}\\)?[-.\\s]?)\\d{3}[-.\\s]?\\d{4}/g) || [])));
  const mailtos = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => (a.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0]).filter(Boolean);
  const socials = Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => /facebook\\.com|instagram\\.com|linkedin\\.com|x\\.com|twitter\\.com|youtube\\.com|tiktok\\.com|pinterest\\.com/i.test(h)).slice(0, 10);
  return { title: document.title || "", url: location.href, text: text.slice(0, 50000), emails, phones, mailtos, socials };
}`;

function isUsableOwnerEmail(email) {
  const e = email.toLowerCase();
  if (REDACTED_WORDS.some((w) => e.includes(w))) return false;
  if (/\.(png|jpe?g|gif|webp|svg|css|pdf|ico)(@[23]x)?$/i.test(e)) return false;
  return true;
}

function emailRank(email) {
  const local = email.split("@")[0].toLowerCase();
  if (GENERIC_PREFIXES.has(local)) return 2;
  if (/^[a-z]+\.[a-z]+$/.test(local) || /^[a-z]+$/.test(local)) return 0;
  return 1;
}

const JUNK_NAME_PARTS = /\b(island|beach|city|county|town|village|road|street|avenue|drive|lane|boulevard|highway|park|state|north|south|east|west|page not found|not found|registration|redact|privacy|proxy|copyright|home|menu|about|contact|support|webmaster|domain)\b/i;

function isPlausibleName(n) {
  const clean = String(n).trim();
  if (!clean) return false;
  if (JUNK_NAME_PARTS.test(clean)) return false;
  const words = clean.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (!/^[A-Z0-9À-Þ]/.test(clean)) return false;
  return words.every((w) => /^[A-Z0-9À-Þ]/.test(w));
}

function extractNames(text, title) {
  const names = [];
  const seen = new Set();
  const push = (n) => {
    const clean = n.trim().replace(/\s+/g, " ");
    if (clean.length >= 3 && clean.length <= 48 && !seen.has(clean) && /[A-Za-z]/.test(clean) && !/\b(copyright|webmaster|support|mailing|address|contact|phone)\b/i.test(clean) && isPlausibleName(clean)) {
      seen.add(clean);
      names.push(clean);
    }
  };

  const keywordFirst = new RegExp(`(${OWNER_KEYWORDS.source})\\s*[\\t:-]?\\s*([A-Z][a-z]+(?:\\s+[A-Z][a-z]*)+(?:\\s+(?:Jr|Sr|III|II))?)`, "gi");
  for (const m of text.matchAll(keywordFirst)) push(m[2]);

  const keywordLast = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]*)+(?:\\s+(?:Jr|Sr|III|II))?)\\s*,\\s*\\b(owner|founder|proprietor|principal|president|director|general manager|managing partner)\\b`, "gi");
  for (const m of text.matchAll(keywordLast)) push(m[1]);

  const withRole = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]*)+(?:\\s+(?:Jr|Sr|III|II))?)\\s+[\\u2014-]\\s+(?:${OWNER_KEYWORDS.source})`, "gi");
  for (const m of text.matchAll(withRole)) push(m[1]);

  if (!names.length && title) {
    const m = title.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]*){1,3})\b[^|]*/);
    if (m && !/[cC]ontact|[aA]bout|home/.test(m[1])) push(m[1]);
  }

  return names.slice(0, 5);
}

function parseWhois(raw) {
  const get = (re) => {
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };
  const redacted = /redacted|privacy|whois privacy|data \s+redact/i.test(raw);
  return {
    available: /no match for|status:\s*free|not found|no entries found/i.test(raw),
    registrar: get(/registrar:\s*(.+)/i),
    created: get(/(?:creation date|created|registered on|domain registration date):\s*(.+)/i),
    updated: get(/(?:updated date|last updated|update date):\s*(.+)/i),
    expires: get(/(?:expiration date|registry expiry|expire date):\s*(.+)/i),
    registrantOrg: get(/(?:registrant organization|registrant org|org-name|org name):\s*(.+)/i),
    registrantName: get(/(?:registrant name|registrant):\s*(.+)/i),
    registrantEmail: get(/empty.*email|registrant email:\s*(.+)/i),
    redacted,
  };
}

function lookupWhois(hostname) {
  return new Promise((resolve) => {
    let raw = "";
    const t = setTimeout(() => resolve(null), 8000);
    try {
      whoisLookup(hostname, { follow: 2, timeout: 7000 }, (err, data) => {
        clearTimeout(t);
        if (err || !data) return resolve(null);
        raw = String(data);
        resolve(parseWhois(raw));
      });
    } catch {
      clearTimeout(t);
      resolve(null);
    }
  });
}

export async function findOwner(inputUrl, timeoutMs = 8000) {
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(inputUrl.trim()) ? inputUrl.trim() : `https://${inputUrl.trim()}`);
  } catch {
    return { error: "Invalid URL" };
  }
  const origin = url.origin;

  const pages = [];
  let visited = 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignore_https_errors: true,
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      locale: "en-US",
    });
    const page = await ctx.newPage();
    for (const path of CANDIDATE_PAGES) {
      if (visited >= 8) break;
      const target = path === "" ? origin : `${origin}${path}`;
      try {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await page.waitForTimeout(500);
        const data = await page.evaluate(`(${OWNER_EXTRACT_SCRIPT})()`);
        visited++;
        if (data && typeof data === "object") pages.push(data);
        if (pages.length >= 3) break;
      } catch {
        visited++;
      }
    }
    await ctx.close();
  } finally {
    await browser.close();
  }

  const emails = new Map();
  const phones = new Set();
  const socials = new Set();
  const names = [];
  const sources = [];

  const addEmail = (e, source) => {
    const email = String(e).trim();
    if (!isUsableOwnerEmail(email)) return;
    if (!emails.has(email)) emails.set(email, { email, sources: [] });
    emails.get(email).sources.push(source);
  };
  const addPhone = (p, source) => phones.add(String(p).trim());
  const addSocial = (s) => socials.add(s);

  for (const p of pages.filter(Boolean).slice(0, 3)) {
    const source = p.title || p.url || "site";
    for (const e of [...(p.mailtos || []), ...(p.emails || [])]) addEmail(e, source);
    for (const pn of p.phones || []) addPhone(pn, source);
    for (const s of p.socials || []) addSocial(s);
    names.push(...extractNames(p.text || "", p.title || ""));
  }

  let whoisData = null;
  try {
    whoisData = await lookupWhois(url.hostname);
  } catch {}

  if (whoisData) {
    if (whoisData.registrantEmail && isUsableOwnerEmail(whoisData.registrantEmail)) {
      addEmail(whoisData.registrantEmail, "WHOIS registrant");
    }
    if (whoisData.registrantName && !/redacted|privacy protect/i.test(whoisData.registrantName)) {
      if (isPlausibleName(whoisData.registrantName)) names.push(whoisData.registrantName);
    }
    if (whoisData.registrantOrg && !/redacted|privacy protect/i.test(whoisData.registrantOrg)) {
      if (isPlausibleName(whoisData.registrantOrg)) names.push(whoisData.registrantOrg);
    }
  }

  const uniqueNames = [...new Set(names)].slice(0, 5);
  const uniqueEmails = [...emails.values()].sort((a, b) => emailRank(a.email) - emailRank(b.email) || a.email.length - b.email.length);
  const uniquePhones = [...phones];
  const uniqueSocials = [...socials];

  const best = uniqueEmails[0] ? uniqueEmails[0].email : "";
  const hasFormButNoEmail = !best && pages.some((p) => /<form/i.test(String(p.text)));

  const preferred = best || (uniqueEmails.length ? uniqueEmails[0].email : "");
  const confidence = Math.min(98, 30 + (uniqueEmails.length ? 30 : 0) + (uniqueNames.length ? 20 : 0) + (preferred && whoisData && whoisData.registrantEmail ? 10 : 0) + (uniquePhones.length ? 8 : 0));

  return {
    ownerName: uniqueNames[0] || "",
    ownerNames: uniqueNames,
    email: preferred,
    emails: uniqueEmails,
    phone: uniquePhones[0] || "",
    phones: uniquePhones,
    socials: uniqueSocials,
    whois: whoisData,
    pagesVisited: pages.length,
    sources,
    confidence: Math.max(20, Math.min(95, confidence)),
  };
}