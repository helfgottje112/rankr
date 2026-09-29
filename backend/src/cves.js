const WORDPRESS_CVES = [
  { id: "CVE-2019-8942", patched: "5.0.1", cvss: 8.8, rce: true, title: "Unauthenticated arbitrary file upload via image crop — leads to remote code execution on the server" },
  { id: "CVE-2019-9787", patched: "5.1.1", cvss: 7.3, rce: true, title: "SSRF in URL validator + path traversal in photo directory — can escalate to remote code execution" },
  { id: "CVE-2020-28037", patched: "5.5.2", cvss: 7.1, title: "Path traversal allowing a logged-in user to manipulate files outside the media folder" },
  { id: "CVE-2020-28038", patched: "5.5.2", cvss: 6.4, title: "Weak input sanitization in media uploads (redirect/privacy issues)" },
  { id: "CVE-2020-28039", patched: "5.5.2", cvss: 6.1, title: "Cross-site scripting in media block rendering" },
  { id: "CVE-2021-29447", patched: "5.7.1", cvss: 8.8, rce: true, title: "XXE in WAV media import via crafted files — server-side request forgery with RCE potential" },
  { id: "CVE-2021-29504", patched: "5.7.2", cvss: 4.3, title: "Stored XSS via crafted post metadata" },
  { id: "CVE-2022-21661", patched: "5.8.3", cvss: 8.8, title: "SQL injection in WP_Query taxonomy handling — readers can read the full database" },
  { id: "CVE-2022-21662", patched: "5.8.3", cvss: 8.8, rce: true, title: "Object injection via unescaped metadata — can lead to remote code execution" },
  { id: "CVE-2022-21663", patched: "5.8.3", cvss: 6.1, title: "Stored XSS in caption/summary rendering" },
  { id: "CVE-2022-21664", patched: "5.8.3", cvss: 7.1, title: "Object injection via taxonomy term names" },
  { id: "CVE-2022-43497", patched: "6.0.3", cvss: 8.8, title: "Authenticated stored cross-site scripting via SVG upload" },
  { id: "CVE-2023-22622", patched: "6.1.1", cvss: 8.8, rce: true, title: "Server-side request forgery via image editor (libxml) — internal network & RCE reach" },
  { id: "CVE-2023-2745", patched: "6.2.1", cvss: 8.8, rce: true, title: "Authenticated object injection in template block rendering — remote code execution" },
  { id: "CVE-2023-2982", patched: "6.2.2", cvss: 4.3, title: "SSRF via outgoing email notifications" },
  { id: "CVE-2023-2860", patched: "6.2.2", cvss: 6.1, title: "Broken access control on redirect handling" },
];

function parseVer(v) {
  const m = String(v || "").match(/(\d+)\.(\d+)\.?(\d+)?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

function verLt(a, b) {
  const A = parseVer(a), B = parseVer(b);
  if (!A || !B) return false;
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] < B[i];
  }
  return false;
}

export function cvssInfo(cvss) {
  if (cvss >= 9.0) return { level: "critical", label: "CRITICAL", color: "#a8071a" };
  if (cvss >= 7.0) return { level: "high", label: "HIGH", color: "#d4380d" };
  if (cvss >= 4.0) return { level: "medium", label: "MEDIUM", color: "#ad6800" };
  return { level: "low", label: "LOW", color: "#389e0d" };
}

export function matchCVEs({ cms, cmsVersion, wpSignals = {} }) {
  if (cms !== "wordpress") return { cves: [], max: null, version: cmsVersion || "" };
  const out = [];
  for (const cve of WORDPRESS_CVES) {
    if (!verLt(cmsVersion, cve.patched)) continue;
    const info = cvssInfo(cve.cvss);
    let exploitable = null;
    if (cve.rce && (wpSignals.usersOpen || (wpSignals.xmlrpcOpen && wpSignals.loginOpen))) exploitable = "remote code execution";
    else if (!wpSignals.usersOpen && !wpSignals.xmlrpcOpen && (cve.rce || cve.title.includes("injection")) && wpSignals.loginOpen) exploitable = "requires login window to be reachable";
    out.push({ ...cve, ...info, exploitable });
  }
  out.sort((a, b) => b.cvss - a.cvss);
  const max = out.length ? { cvss: out[0].cvss, ...cvssInfo(out[0].cvss), count: out.length, top: out.slice(0, 3).map((c) => c.id) } : null;
  return { cves: out, max, version: cmsVersion || "" };
}