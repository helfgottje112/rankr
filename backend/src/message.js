const GREETINGS = (name) => [`Hi ${name},`, `Hello ${name},`, `Hi there ${name},`];

const FINDING_LINES = (audit) => {
  const top = [...(audit.findings || [])].sort((a, b) => b.points - a.points).slice(0, 3);
  return top.map((f) => `- ${f.message}`).join("\n");
};

const ATTACK_RULES = [
  { re: /xmlrpc/i, types: ["DDoS amplification", "credential brute-force"] },
  { re: /wp-login|login exposed/i, types: ["password brute-force", "account takeover"] },
  { re: /wp-json[\s\S]*users|user enumeration|username/i, types: ["admin account enumeration", "targeted phishing", "ransomware entry point"] },
  { re: /plain http|does not use https/i, types: ["on-path interception", "credential theft"] },
  { re: /x-frame-options|frame-ancestors|clickjacking/i, types: ["clickjacking"] },
  { re: /content-security-policy/i, types: ["cross-site scripting (XSS)", "malware injection"] },
  { re: /strict-transport|hsts/i, types: ["protocol downgrade", "session hijack"] },
  { re: /server reveals|stack disclosed|x-powered/i, types: ["targeted exploit intel"] },
];

function attackTypes(audit) {
  const seen = new Set();
  const add = (t) => t && seen.add(t);
  const secFindings = (audit.findings || []).filter((f) => f.category === "security");
  const haystack = [...secFindings.map((f) => f.message), ...((audit.hackRisk && audit.hackRisk.factors) || [])].join(" | ");
  for (const rule of ATTACK_RULES) if (rule.re.test(haystack)) rule.types.forEach(add);
  if (audit.cms === "wordpress") {
    add("malware & SEO spam");
    if ((audit.hackRisk && audit.hackRisk.level) === "high") add("defacement / ransomware");
  }
  return [...seen];
}

const SEC_LINES = (audit) => {
  const lines = [];
  const risk = audit.hackRisk && audit.hackRisk.level;
  const factors = (audit.hackRisk && audit.hackRisk.factors) || [];
  const cms = audit.cms ? String(audit.cms) : "";
  const cmsTag = cms.toUpperCase() + (audit.cmsVersion ? ` ${audit.cmsVersion}` : "");
  if (risk === "high") {
    lines.push(`- Right now your site has a HIGH security risk${cms ? ` (it runs ${cmsTag})` : ""} — ${(factors.slice(0, 2).join(", ")) || "several exposed endpoints"}. This is how business sites get defaced or taken down, and it's the first thing people check before doing business with you.`);
  } else if (risk === "medium") {
    lines.push(`- There are a few security gaps worth closing${factors.length ? ` (${factors.join(", ")})` : ""}${cms ? ` — including on your ${cmsTag} install` : ""}.`);
  }
  if (cms === "wordpress") {
    lines.push(`- WordPress sites are a top target for hackers — up-to-date core, plugins, and login protection make a real difference.`);
  }
  const attacks = attackTypes(audit);
  if (attacks.length) {
    lines.push(`- Attackers could try: ${attacks.join(", ")} — all of this is stoppable once you patch the exposed pieces.`);
  }
  if (risk === "high" || risk === "medium") {
    lines.push(`- The fastest fix (free): put the site behind Cloudflare — it hides the admin login, blocks XML-RPC floods, absorbs DDoS before it hits your host, and adds free HTTPS. I can set this up for you.`);
  }
  return lines;
};

const PAIN_LINES = (audit) => {
  const sec = SEC_LINES(audit);
  const top = [...(audit.findings || [])]
    .filter((f) => f.category !== "security")
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((f) => `- ${f.message}`);
  return [...sec, ...top].slice(0, 4).join("\n") || "- No standout issues, but there's room to convert more visitors.";
};

const SIGNATURES = (yourName) => [
  yourName ? `Best,\n${yourName}` : `Best,\nYour Team`,
  yourName ? `Cheers,\n${yourName}` : `Kind regards,\nYour Team`,
  yourName ? `Thanks,\n${yourName}` : `All the best,\nYour Team`,
];

export function draftMessage({ owner, audit, yourName = "", yourPhone = "", variant = 0 }) {
  const name = owner.ownerName || "";
  const email = owner.email || "";
  const domain = audit.domain || "";
  const business = audit.businessName || domain;

  const greeting = name ? ["Hi", `Hello`, `Hi there`][variant] + ` ${name},` : ["Hi there,", "Hello,", "Hi,"][variant];

  const intro = [
    `I was running a quick health check on ${domain} and wanted to pass along a few honest observations about ${business}.`,
    `I took a close look at ${domain} recently, and a few things jumped out that are quietly costing ${business} customers.`,
    `While looking over ${domain}, I noticed a handful of issues every business owner would want to know about.`,
  ][variant];

  const pivot = [
    "All of these are fixable — some are free, some take an afternoon. Either way they pay for themselves quickly in questions, calls, and bookings from people who are already searching for exactly what you offer.",
    "These are the kind of fixes that show up directly in how many visitors turn into actual customers.",
    "Each one is straightforward to fix, and the payoff is immediate visibility and trust with people who land on your site.",
  ][variant];

  const ask = [
    "Would you be open to a quick call? I'll walk you through what I found and show you the fixes as short videos.",
    "If it's helpful, I can send over a step-by-step plan for the top fixes — no obligation.",
    "Want me to send a short video walking through the most impactful fix?",
  ][variant];

  const signoff = SIGNATURES(yourName)[variant];

  let buttress = "";
  if (yourPhone) {
    buttress += `\nYou can also reach me anytime at ${yourPhone}.\n`;
  }

  let subject;
  if (name && domain) subject = `${domain} — quick heads-up${business ? ` about ${business}` : ""}`;
  else if (domain) subject = `A quick heads-up about ${domain}`;
  else subject = "Quick heads-up about your website";

  const body =
`${greeting}

${intro}

Here's what I found:

${PAIN_LINES(audit)}
${pivot}

${ask}${buttress}
${signoff}`;

  return {
    to: email || "",
    toName: name || "",
    subject,
    body,
  };
}