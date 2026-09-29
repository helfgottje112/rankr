const INDUSTRIES = [
  {
    name: "SaaS & Tech",
    keywords: ["software", "app", "saas", "tech", "cloud", "platform", "digital", "ai"],
    companies: ["Nimbus Labs", "Quantix Systems", "Vertex Commerce", "BrightLoop", "Datafold", "Orbital Works"],
    firstNames: ["Marcus", "Sofia", "Elena", "Devon", "Priya", "Andre", "Nadia", "Tomas"],
    roles: ["Head of Growth", "CEO", "Marketing Director", "Product Lead"],
  },
  {
    name: "Professional Services",
    keywords: ["consulting", "legal", "finance", "accounting", "marketing", "agency", "real estate", "insurance"],
    companies: ["Summit Advisory", "Harbor & Co.", "Redwood Partners", "ClearBridge Group", "Metro Legal", "Lakeside Consulting"],
    firstNames: ["Rachel", "James", "Amara", "Victor", "Helen", "Derek", "Monica", "Sam"],
    roles: ["Managing Partner", "Principal", "Director of Operations", "Founder"],
  },
  {
    name: "Health & Wellness",
    keywords: ["clinic", "dental", "fitness", "wellness", "therapy", "med", "care", "spa", "gym"],
    companies: ["BrightPath Clinic", "Zenith Dental", "VitalSignature Fitness", "Everwell Care", "CoreMotion Gym", "Pulse Wellness"],
    firstNames: ["Isabella", "Ryan", "Lauren", "Marcus", "Aisha", "Nathan", "Grace", "Elijah"],
    roles: ["Practice Owner", "Director", "Operations Manager", "Head Doctor"],
  },
  {
    name: "E-commerce & Retail",
    keywords: ["shop", "store", "ecommerce", "retail", "buy", "products", "fashion", "deals", "bakery", "cafe", "restaurant", "food"],
    companies: ["Urban Nest", "Coastal Goods", "The Daily Pantry", "Lumen & Co.", "Modern Morsel", "Brightline Retail"],
    firstNames: ["Chloe", "Omar", "Tara", "Leo", "Maya", "Felix", "Danielle", "Hugo"],
    roles: ["Owner", "E-commerce Manager", "Marketing Lead", "Founder"],
  },
  {
    name: "Construction & Trades",
    keywords: ["construction", "roofing", "plumbing", "electric", "contractor", "remodel", "paving", "heating", "hvac"],
    companies: ["Ironclad Builders", "Summit Roofing Co.", "Arrow Plumbing", "PrimeLine Contractors", "Sterling Construction"],
    firstNames: ["Bill", "Frank", "Gina", "Ray", "Jenna", "Tom", "Sandra", "Mike"],
    roles: ["Owner", "Bid Manager", "Office Manager", "Estimator"],
  },
];

const LAST_NAMES = ["Carter", "Nguyen", "Silva", "Brooks", "Patel", "Hughes", "Moreno", "Kane", "Reyes", "Foster"];
const EMAIL_PROVIDERS = ["gmail.com", "outlook.com", "yahoo.com", "protonmail.com"];
const TLD = ["com", "co", "io", "net", "org"];

const OUTREACH_TEMPLATES = [
  ({ domain, issue1, yourName }) => ({
    subject: `${domain} — website audit quick win`,
    body:
`Hi there,

I was looking at ${domain} recently and wanted to pass along a free observation: ${issue1}. That alone is quietly costing you conversions.

The fix is usually straightforward, and the payoff is immediate.${yourName ? ` My team at ${yourName} helps businesses implement exactly this.` : ""}

Happy to send a quick, no-obligation summary of the top 3 improvements. Would that be useful?

Best,
${yourName || "Your Team"}`,
  }),
  ({ domain, issue1, issue2, yourName }) => ({
    subject: `Quick heads-up about ${domain}`,
    body:
`Hi,

While evaluating ${domain}, I noticed two things worth your attention: ${issue1}, and ${issue2}. Both are fixable and both have a direct impact on new business.${yourName ? ` At ${yourName} we handle exactly this kind of turnaround.` : ""}

If you'd like, I can run a full audit and send the top fixes — takes me about a day.

Cheers,
${yourName || "Your Team"}`,
  }),
  ({ domain, issue1, yourName }) => ({
    subject: `A quick fix for ${domain}`,
    body:
`Hi,

I found a small but meaningful issue on ${domain}: ${issue1}.

For most businesses in your space this is a quick fix that pays off immediately.${yourName ? ` We'd be happy to do it for you at ${yourName}.` : ""}

Want me to send a short video walking through the fix?

Best,
${yourName || "Your Team"}`,
  }),
];

const CATEGORY_MESSAGES = {
  mobile: "limits mobile usability",
  ux: "creates a confusing or cramped user experience",
  design: "looks dated and inconsistent",
  performance: "loads slowly, hurting engagement",
  trust: "doesn't inspire visitor trust",
  conversion: "fails to convert visitors into leads",
  seo: "ranks poorly in search",
  accessibility: "is hard to use for people with disabilities",
  navigation: "makes it hard to find key pages",
  content: "lacks compelling content",
  animations: "uses distracting or outdated animation",
  marketing: "misses obvious marketing signals",
  reliability: "has reliability problems",
  security: "has security or HTTPS issues",
  code: "has messy or heavy code",
};

function pick(arr, rng, n = 1) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return n === 1 ? out[0] : out;
}

function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function generateLeads(audit, opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = makeRng(seed);
  const yourName = (opts.yourName || "").trim();

  const haystack = `${audit.title} ${audit.domain} ${audit.businessName} ${audit.industryGuess}`.toLowerCase();
  const industry = INDUSTRIES.find((ind) => ind.keywords.some((k) => haystack.includes(k))) ||
    INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)];

  const topFindings = [...(audit.findings || [])].sort((a, b) => b.points - a.points);
  const coreIssues = topFindings.slice(0, 4);
  const pool = coreIssues.length ? coreIssues : [{ category: "mobile", points: 1, message: "isn't optimized for mobile" }];

  const leads = Array.from({ length: 6 }, (_, i) => {
    const company = pick(industry.companies, rng).replace(/\s/g, "-");
    const firstName = pick(industry.firstNames, rng);
    const lastName = pick(LAST_NAMES, rng);
    const role = pick(industry.roles, rng);
    const provider = pick(EMAIL_PROVIDERS, rng);
    const picks = pick(pool, rng, Math.min(3, pool.length));
    const pains = picks.map((f) => {
      const cat = CATEGORY_MESSAGES[f.category] || "isn't optimized for conversions";
      return `your site ${cat}`;
    });
    const safePains = pains.length ? pains : ["your site isn't optimized for mobile visitors"];

    const fixes = picks.slice(0, 2).map((f) => ({
      category: f.category,
      fix: fixSuggestionFor(f.category, audit),
    }));

    const template = pick(OUTREACH_TEMPLATES, rng);
    const outreach = template({
      domain: audit.domain || "your site",
      issue1: safePains[0],
      issue2: safePains[1],
      yourName,
    });

    return {
      company: company.split("-").join(" "),
      domain: `${company.toLowerCase()}.${pick(TLD, rng)}`,
      title: `${firstName} ${lastName}`,
      role,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${provider}`,
      phone: `(${120 + Math.floor(rng() * 779)}) ${100 + Math.floor(rng() * 899)}-${1000 + Math.floor(rng() * 8999)}`,
      industry: industry.name,
      painPoints: safePains,
      fixes,
      outreach,
      score: Math.max(30, Math.min(95, audit.score + (i - 3) * 3)),
      seed,
    };
  });

  const summary = {
    sourceUrl: audit.finalUrl || audit.url,
    businessName: audit.businessName,
    industry: audit.industryGuess || "unknown",
    topIssues: topFindings.slice(0, 5).map((f) => ({ category: f.category, points: f.points, message: f.message })),
    pitchAngle: audit.pitchAngle,
    fixSuggestion: audit.fixSuggestion,
    verdict: audit.verdict,
    audience: `The site appears to be in the ${audit.industryGuess || "unknown"} space. Leads below are simulated prospects matching that profile, with outreach angles built directly from the audit findings.`,
    disclaimer: "Generated leads are simulated for demonstration and outreach-training purposes. Verify all contact data before use.",
  };

  return { seed, yourName, summary, leads };
}

function fixSuggestionFor(category, audit) {
  switch (category) {
    case "mobile":
      return audit.fixSuggestion.includes("mobile-first") ? audit.fixSuggestion : "Rebuild the layout mobile-first to eliminate overflow and off-screen content.";
    case "conversion":
      return "Add a clear above-the-fold value proposition with one strong call-to-action.";
    case "performance":
      return "Compress assets, lazy-load below-the-fold content, and set caching headers.";
    case "trust":
      return "Add contact details, reviews, and social proof to the page.";
    case "design":
      return "Standardize fonts and colors and modernize the visual design.";
    case "navigation":
      return "Simplify navigation and fix dead or placeholder links.";
    case "seo":
      return "Add a title, meta description, proper headings, and structured data.";
    default:
      return audit.fixSuggestion;
  }
}