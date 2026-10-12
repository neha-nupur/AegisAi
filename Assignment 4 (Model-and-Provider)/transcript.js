const { spawn } = require("child_process");
const http = require("http");

const svc = spawn("node", ["app.js"], { env: { ...process.env, PORT: "8002" }, cwd: __dirname });
let out = "";
svc.stdout.on("data", (d) => { out += d; });

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
function show(title, method, path, res) {
  lines.push(`### ${title}`);
  lines.push(`${method} ${path} -> HTTP ${res.status}`);
  if (res.headers.location) lines.push(`Location: ${res.headers.location}`);
  lines.push(res.body);
  lines.push("");
}

(async () => {
  await new Promise((r) => setTimeout(r, 1200));
  // 1. create provider (201 + Location)
  let res = await req({ method: "POST", path: "/v1/providers", headers: H({ "Idempotency-Key": "demo-1" }) },
    { name: "OpenAI", type: "openai" });
  show("1. Create provider", "POST", "/v1/providers", res);
  // 2. same request, same idempotency key -> 200 original
  res = await req({ method: "POST", path: "/v1/providers", headers: H({ "Idempotency-Key": "demo-1" }) },
    { name: "OpenAI", type: "openai" });
  show("2. Idempotent repeat (same key)", "POST", "/v1/providers", res);
  const provId = JSON.parse(res.body).providerId;
  // 3. malformed body -> 400
  res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "" });
  show("3. Malformed body", "POST", "/v1/providers", res);
  // 4. duplicate name -> 409
  res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "OpenAI", type: "gemini" });
  show("4. State conflict (duplicate name)", "POST", "/v1/providers", res);
  // 5. missing resource -> 404
  res = await req({ method: "GET", path: "/v1/providers/prov-999/health", headers: H() });
  show("5. Missing resource", "GET", "/v1/providers/prov-999/health", res);
  // 6. register model (201 + Location)
  res = await req({ method: "POST", path: `/v1/providers/${provId}/models`, headers: H() },
    { name: "gpt-model", capabilities: ["text-generation", "summarization"], sensitivityLevel: "internal" });
  show("6. Register model", "POST", `/v1/providers/${provId}/models`, res);
  const modelId = JSON.parse(res.body).modelId;
  // 7. filtered list (200)
  res = await req({ method: "GET", path: "/v1/models?capability=summarization", headers: H() });
  show("7. Filtered list", "GET", "/v1/models?capability=summarization", res);
  // 8. single read (200)
  res = await req({ method: "GET", path: `/v1/providers/${provId}/models/${modelId}`, headers: H() });
  show("8. Single model read", "GET", `/v1/providers/${provId}/models/${modelId}`, res);
  // 9. health (200)
  res = await req({ method: "GET", path: `/v1/providers/${provId}/health`, headers: H() });
  show("9. Provider health", "GET", `/v1/providers/${provId}/health`, res);
  // 10. route-and-invoke (200)
  res = await req({ method: "POST", path: "/v1/route-and-invoke", headers: H() },
    { request: { requestId: "req-1", messages: [{ role: "user", content: "summarise AegisAI" }] }, policyDecision: "ALLOW" });
  show("10. Route and invoke", "POST", "/v1/route-and-invoke", res);

  require("fs").writeFileSync(__dirname + "/curl-transcript.txt", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  svc.kill();
  process.exit(0);
})().catch((e) => { console.error(e); svc.kill(); process.exit(1); });
