import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 43212;
const base = `http://127.0.0.1:${port}`;
let server;

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Rankr test server did not become ready");
}

before(async () => {
  server = spawn(process.execPath, ["src/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
});

after(() => server?.kill("SIGKILL"));

test("demo login accepts form data and protects admin routes", async () => {
  const login = await fetch(`${base}/wp-login.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ log: "admin", pwd: "letmein123" }),
    redirect: "manual",
  });
  assert.equal(login.status, 302);
  assert.equal(login.headers.get("location"), "/wp-admin/");
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /rankr_demo_session=/);

  const denied = await fetch(`${base}/wp-admin/`);
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${base}/wp-admin/`, { headers: { cookie } });
  assert.equal(allowed.status, 200);
  assert.match(await allowed.text(), /logged in as/);
});

test("synthetic upload is POST-only, authenticated, and labeled simulated", async () => {
  const denied = await fetch(`${base}/wp-admin/async-upload.php`, { method: "POST" });
  assert.equal(denied.status, 401);

  const login = await fetch(`${base}/wp-login.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ log: "admin", pwd: "letmein123" }),
    redirect: "manual",
  });
  const response = await fetch(`${base}/wp-admin/async-upload.php`, {
    method: "POST",
    headers: { cookie: login.headers.get("set-cookie") },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.simulated, true);
  assert.equal(body.success, true);
});

test("XML parser recognizes system.listMethods", async () => {
  const response = await fetch(`${base}/xmlrpc.php`, {
    method: "POST",
    headers: { "content-type": "text/xml" },
    body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>',
  });
  const text = await response.text();
  assert.match(text, /pingback\.ping/);
  assert.doesNotMatch(text, /Method &quot;unknown&quot;/);
});

test("public demo has guided links, correct limits, and no localhost link", async () => {
  const html = await (await fetch(`${base}/demo/`)).text();
  assert.match(html, /Audit this demo in Rankr/);
  assert.match(html, /View remediated site/);
  assert.match(html, /Business type/);
  assert.doesNotMatch(html, /localhost:5174/);
  assert.doesNotMatch(html, /value="500"/);
});

test("walkthrough computes outcomes instead of hard-coding success", async () => {
  const html = await (await fetch(`${base}/demo/hackplay.html`)).text();
  assert.match(html, /stepResults/);
  assert.match(html, /SIMULATED/);
  assert.doesNotMatch(html, /9 out of 9 phases succeeded/);
});

test("Rankr keeps security probes inside the remediated fixture", async () => {
  const response = await fetch(`${base}/api/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: `${base}/fixed/` }),
  });
  assert.equal(response.status, 200);
  const audit = await response.json();
  assert.deepEqual(audit.hackRisk?.factors, ["served over plain HTTP"]);
  assert.equal(audit.cms || "", "");
  assert.equal(audit.findings.some((f) => /wp-login|xmlrpc|usernames|debug\.log/i.test(f.message)), false);
});

test("remediated target sends defensive headers and blocks probes", async () => {
  const response = await fetch(`${base}/fixed/`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal((await fetch(`${base}/fixed/wp-json/wp/v2/users`)).status, 404);
  assert.equal((await fetch(`${base}/fixed/wp-login.php`)).status, 403);
});
