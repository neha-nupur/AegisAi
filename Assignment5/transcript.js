const { spawn } = require("child_process");
const http = require("http");

const svc = spawn("node", ["app.js"], { env: { ...process.env, PORT: "8002" }, cwd: __dirname });

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: 8002, ...opts }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const H = (extra = {}) => ({
  "Content-Type": "application/json",
  Authorization: "Bearer demo-token",
  "X-Organization-Id": "org-1",
  ...extra
});

const lines = [];
function show(title, method, path, res, reqHeaders = null) {
  lines.push(`### ${title}`);
  if (reqHeaders) lines.push(`Request headers: ${reqHeaders}`);
  lines.push(`${method} ${path} -> HTTP ${res.status}`);
  for (const h of ["location", "etag", "allow", "cache-control", "x-ratelimit-limit", "x-ratelimit-remaining", "retry-after", "access-control-allow-origin"]) {
    if (res.headers[h]) lines.push(`${h}: ${res.headers[h]}`);
  }
  lines.push(res.body || "(no body)");
  lines.push("");
}

(async () => {
  await new Promise((r) => setTimeout(r, 1200));
  let res = await req({ method: "POST", path: "/v1/providers", headers: H({ "Idempotency-Key": "a5-1" }) },
    { name: "OpenAI", type: "openai" });
  show("1. Create provider (201 + Location)", "POST", "/v1/providers", res);
  const provId = JSON.parse(res.body).providerId;

  res = await req({ method: "POST", path: "/v1/providers", headers: H({ "Idempotency-Key": "a5-1" }) },
    { name: "OpenAI", type: "openai" });
  show("2. Idempotent repeat (same key -> 200 original)", "POST", "/v1/providers", res);

  res = await req({ method: "POST", path: `/v1/providers/${provId}/models`, headers: H() },
    { name: "gpt-model", capabilities: ["text-generation"], sensitivityLevel: "internal" });
  show("3. Register model (201 + Location)", "POST", `/v1/providers/${provId}/models`, res);
  const modelId = JSON.parse(res.body).modelId;

  res = await req({ method: "GET", path: `/v1/providers/${provId}/models/${modelId}`, headers: H() });
  show("4. Single read (200 + ETag + Cache-Control)", "GET", `/v1/providers/${provId}/models/${modelId}`, res);
  const etag = res.headers.etag;

  res = await req({ method: "GET", path: `/v1/providers/${provId}/models/${modelId}`, headers: H({ "If-None-Match": etag }) },
    null);
  show("5. Conditional GET (304, no body)", "GET", `/v1/providers/${provId}/models/${modelId}`, res, `If-None-Match: ${etag}`);

  const gp = await req({ method: "GET", path: `/v1/providers/${provId}`, headers: H() });
  const petag = gp.headers.etag;
  res = await req({ method: "PATCH", path: `/v1/providers/${provId}`, headers: H({ "If-Match": '"mp-stale0000000000"' }) },
    { timeoutMs: 9999 });
  show("6. Conditional write stale (412)", "PATCH", `/v1/providers/${provId}`, res, "If-Match: stale");

  res = await req({ method: "PATCH", path: `/v1/providers/${provId}`, headers: H({ "If-Match": petag }) },
    { timeoutMs: 9000 });
  show("7. Conditional write fresh (200)", "PATCH", `/v1/providers/${provId}`, res, `If-Match: ${petag}`);

  res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "" });
  show("8. Malformed body (400)", "POST", "/v1/providers", res);

  res = await req({ method: "GET", path: "/v1/providers/prov-999/health", headers: H() });
  show("9. Missing resource (404)", "GET", "/v1/providers/prov-999/health", res);

  res = await req({ method: "GET", path: "/v1/models", headers: { "X-Organization-Id": "org-1" } });
  show("10. Missing bearer (401)", "GET", "/v1/models", res);

  require("fs").writeFileSync(__dirname + "/curl-transcript.txt", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  svc.kill();
  process.exit(0);
})().catch((e) => { console.error(e); svc.kill(); process.exit(1); });
