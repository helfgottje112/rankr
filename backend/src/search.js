import { getBrowser, browserContext } from "./audit.js";

const STRICT_SKIP = [
  "google.", "duckduckgo.com", "bing.com", "search.",
  "facebook.", "instagram.com", "twitter.com", "x.com", "linkedin.com", "youtube.com", "tiktok.com",
  "maps.google", "waze.com", "mapquest.com", "wikipedia.org", "wikidata.org",
];
const HARD_SKIP = [
  "google.com", "google.", "duckduckgo.com", "bing.com", "search.", "wiki", "youtube.com",
  "facebook.", "instagram.com", "tiktok.com", "twitter.com", "x.com", "linkedin.com", "pinterest.com", "reddit.com",
  "yellowpages.com", "yelp.com", "angi.com", "thumbtack.com", "superpages.com", "bbb.org", "expertise.com", "mapquest.com",
  "manta.com", "chamberofcommerce.com", "webmd.com", "vitals.com", "healthgrades.com", "zocdoc.com", "threebestrated.com",
  "deltadental.com", "usnews.com", "carecredit.com", "caredash.com", "opencare.com", "1800dentist.com",
  "worldtimebuddy.com", "timeanddate.com", "24timezones.com", "timetranslator.com", "thetimezoneconverter.com",
  "amazon.com", "amazon.", "walmart.com", "target.com", "bestbuy.com", "sephora.com", "ulta.com", "homedepot.com", "lowes.com",
  "merriam-webster.com", "britannica.com", "dictionary.com", "cambridge.org", "ebay.com", "etsy.com", "apple.com", "microsoft.com"
];

function isUsable(url, strict = true) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (HARD_SKIP.some((s) => host === s.replace(/\.$/, "") || host.includes(s.replace(/\.$/, "")))) return false;
    if (strict && STRICT_SKIP.some((s) => host === s || host.startsWith(s.replace(/^\./, "")) || host.includes(s.replace(/^\./, "")))) return false;
    if (/\.(png|jpe?g|gif|webp|svg|css|pdf|zip|xml)$/i.test(u.pathname)) return false;
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

function uniqueResults(list, max) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

function decodeSearchUrl(href) {
  let out = href;
  try {
    const u = new URL(href.replace(/&amp;/g, "&"));
    if (u.hostname.endsWith("bing.com")) {
      let inner = u.searchParams.get("u");
      if (inner && inner.startsWith("a1")) inner = inner.slice(2);
      if (inner) {
        const dec = Buffer.from(inner, "base64url").toString("utf8");
        if (/^https?:\/\//i.test(dec)) out = dec;
      }
    } else if (u.hostname.endsWith("google.com") && u.pathname.startsWith("/url")) {
      const q = u.searchParams.get("q");
      if (q && /^https?:\/\//i.test(q)) out = q;
    }
  } catch {}
  return out;
}

async function duckDuckGo(query, strict = true) {
  const results = [];
  for (const s of [0]) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${s}`;
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) break;
      html = await res.text();
    } catch { break; }
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    let fromPage = [];
    while ((m = re.exec(html)) !== null) {
      let href = m[1].replace(/&amp;/g, "&");
      if (href.includes("uddg=")) {
        try {
          const raw = /^https?:/.test(href) ? href : `https:${href}`;
          const u = new URL(raw);
          href = decodeURIComponent(u.searchParams.get("uddg") || href);
        } catch {
          href = "";
        }
      }
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      if (isUsable(href, strict)) fromPage.push({ url: href, title });
    }
    const snipRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let si = 0;
    while ((m = snipRe.exec(html)) !== null && si < fromPage.length) {
      fromPage[si].snippet = m[1].replace(/<[^>]+>/g, "").trim();
      si++;
    }
    results.push(...fromPage);
    if (fromPage.length < 20) break;
  }
  return uniqueResults(results, 90);
}

async function bing(query, strict = true, pages = 3) {
  const results = [];
  const pageOffsets = [1, 21, 41, 61].slice(0, Math.max(1, pages));
  await Promise.all(
    pageOffsets.map(async (first) => {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=20&mkt=en-US`;
      let html = "";
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "text/html",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) return;
        html = await res.text();
      } catch { return; }
      const liRe = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)<\/li>/gi;
      let m;
      while ((m = liRe.exec(html)) !== null) {
        const href = decodeSearchUrl(m[1]);
        const title = m[2].replace(/<[^>]+>/g, "").trim();
        const snipMatch = m[3].match(/<p[^>]*>([\s\S]*?)<\/p>/);
        const snippet = snipMatch ? snipMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        if (isUsable(href, strict)) results.push({ url: href, title, snippet });
      }
    })
  );
  return uniqueResults(results, 80);
}

async function brave(query, strict = true) {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch { return []; }
  const snippetRe = /<div class="snippet[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/div>/gi;
  const results = [];
  let m;
  while ((m = snippetRe.exec(html)) !== null && results.length < 20) {
    const href = m[1].replace(/&amp;/g, "&");
    const title = m[2].replace(/<[^>]+>/g, "").trim();
    const snippet = (m[3] || "").replace(/<[^>]+>/g, "").trim().slice(0, 220);
    if (isUsable(href, strict)) results.push({ url: href, title, snippet });
  }
  return uniqueResults(results, 28);
}

async function google(query, strict = true) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=15`;
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch { return []; }
  const urlRe = /\/url\?q=([^&"]+)/g;
  const titleRe = /jsname="UWckNb"[^>]*>([\s\S]*?)<\/a>/g;
  const urls = [];
  let m;
  while ((m = urlRe.exec(html)) !== null && urls.length < 15) {
    const href = m[1].replace(/&amp;/g, "&");
    if (isUsable(href, strict)) urls.push(href);
  }
  const titles = [];
  while ((m = titleRe.exec(html)) !== null && titles.length < urls.length) {
    titles.push(m[1].replace(/<[^>]+>/g, "").trim());
  }
  const results = urls.map((u, i) => ({ url: u, title: titles[i] || "" }));
  return uniqueResults(results, 22);
}

const ALL_ENGINES = ["duckduckgo", "bing", "brave", "google"];

const B_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const PAGE_URL = {
  duckduckgo: (q, p) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&s=${p * 30}`,
  bing: (q, p) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&first=${p * 10 + 1}&count=10&mkt=en-US`,
  google: (q, p) => `https://www.google.com/search?q=${encodeURIComponent(q)}&start=${p * 10}&num=10&hl=en&gl=us`,
  brave: (q, p) => `https://search.brave.com/search?q=${encodeURIComponent(q)}${p ? `&offset=${p * 10}` : ""}`,
};

const EXTRACTORS = {
  duckduckgo: `() => [...document.querySelectorAll('a.result__a')].map(a => { const u = new URL(a.href); const real = u.searchParams.get('uddg'); return { u: real || a.href, t: (a.textContent || '').trim() }; })`,
  bing: `() => [...document.querySelectorAll('li.b_algo')].map(li => { const a = li.querySelector('h2 a'); if (!a) return null; const p = li.querySelector('.b_caption p, .b_lineclamp2, p'); return { u: a.href, t: (a.textContent || '').trim(), s: p ? (p.textContent || '').trim() : '' }; }).filter(Boolean)`,
  google: `() => [...document.querySelectorAll('h3')].map(h => { const a = h.closest('a'); if (!a) return null; return { u: a.href, t: (h.textContent || '').trim() }; }).filter(Boolean)`,
  brave: `() => [...document.querySelectorAll('div.snippet')].map(d => { const a = d.querySelector('a'); return a ? { u: a.href, t: (a.textContent || '').trim() } : null; }).filter(Boolean)`,
};

const NEXT_SELECTOR = {
  duckduckgo: 'a[rel="next"]',
  bing: 'a[title="Next page"], a.sb_pagN',
  google: "a#pnnext",
  brave: null,
};

async function browserResults(engine, query, strict, maxPages = 3) {
  const ctx = await browserContext({
    user_agent: B_UA,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  try {
    const page = await ctx.newPage();
    const out = [];
    const seen = new Set();
    for (let p = 0; p < maxPages; p++) {
      let html = "";
      try {
        await page.goto(PAGE_URL[engine](query, p), { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(1600);
        await page.evaluate(() => document.body.scrollHeight).catch(() => null);
      } catch {
        continue;
      }
      let links = [];
      try { links = await page.evaluate(EXTRACTORS[engine]); } catch { links = []; }
      for (const l of links) {
        if (!l || !l.u) continue;
        if (engine === "bing" || engine === "google") l.u = decodeSearchUrl(l.u);
        if (seen.has(l.u)) continue;
        seen.add(l.u);
        if (isUsable(l.u, strict)) out.push({ url: l.u, title: l.t || "", snippet: l.s || "" });
      }
      if (links.length < 4) break;
      const nextSel = NEXT_SELECTOR[engine];
      if (!nextSel) break;
      const clicked = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.click();
        return true;
      }, nextSel).catch(() => false);
      if (!clicked) break;
      await page.waitForTimeout(1200);
    }
    return out;
  } finally {
    await ctx.close().catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function searchWeb(query, options = {}) {
  const limit = options.limit || 10;
  const strict = options.strict !== false;
  let engines = options.engines || ALL_ENGINES;
  if (Array.isArray(engines) && engines.length === 1 && (engines[0] === "all" || engines[0] === "auto")) {
    engines = ["bing", "duckduckgo", "google", "brave"];
  }

  const results = [];
  const used = [];

  // Bing is blazing fast (200-300ms) and reliable
  if (engines.includes("bing")) {
    try {
      const pages = limit > 30 ? 4 : limit > 15 ? 3 : 2;
      const bRes = await bing(query, strict, pages);
      if (Array.isArray(bRes) && bRes.length) {
        used.push("bing");
        results.push(...bRes);
      }
    } catch {}
  }

  // If we already have enough results from Bing, return immediately!
  if (results.length >= limit) {
    return {
      engine: used.join(" + ") || "bing",
      query,
      results: uniqueResults(results, limit),
      errors: [],
    };
  }

  // Otherwise, query remaining engines with fast fetch
  const map = { duckduckgo: duckDuckGo, brave, google };
  const others = engines.filter((e) => e !== "bing" && map[e]);

  if (others.length) {
    const settled = await Promise.allSettled(
      others.map(async (e) => {
        let list = [];
        try { list = await map[e](query, strict); } catch {}
        return { e, list };
      })
    );
    for (const s of settled) {
      if (s.status === "fulfilled" && Array.isArray(s.value.list) && s.value.list.length) {
        used.push(s.value.e);
        results.push(...s.value.list);
      }
    }
  }

  return {
    engine: used.join(" + ") || "web",
    query,
    results: uniqueResults(results, limit),
    errors: [],
  };
}