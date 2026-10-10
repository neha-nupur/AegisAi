const { spawn } = require("child_process");
const http = require("http");

const svc = spawn("node", ["app.js"], { env: { ...process.env, PORT: "8002" }, cwd: __dirname });

function req(opts, body, raw) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: 8002, ...opts }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    r.on("error", reject);
    if (raw !== undefined) r.write(raw);
    else if (body) r.write(JSON.stringify(body));
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
function show(title, method, path, res, note = null) {
  lines.push(`### ${title}`);
  lines.push(`${method} ${path} -> HTTP ${res.status}${note ? ` (${note})` : ""}`);
  for (const h of ["content-type", "location", "retry-after", "etag"]) {
    if (res.headers[h]) lines.push(`${h}: ${res.headers[h]}`);
  }
  lines.push(res.body || "(no body)");
  lines.push("");
}

(async () => {
  await new Promise((r) => setTimeout(r, 1200));
  let res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "OpenAI", type: "openai" });
  show("D1 success: create provider", "POST", "/v1/providers", res);
  const provId = JSON.parse(res.body).providerId;

  res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "", type: "bogus", timeoutMs: -5 });
  show("B3/C2 field-level 422 (three bad fields at once)", "POST", "/v1/providers", res);

  res = await req({ method: "POST", path: "/v1/providers", headers: H() }, { name: "OpenAI", type: "gemini" });
  show("D2 conflict 409 (duplicate name)", "POST", "/v1/providers", res);

  res = await req({ method: "GET", path: "/v1/providers/prov-999/health", headers: H() });
  show("D2 unknown id 404", "GET", "/v1/providers/prov-999/health", res);

  res = await req({ method: "GET", path: "/v1/models", headers: { "X-Organization-Id": "org-1" } });
  show("D2 missing token 401", "GET", "/v1/models", res);

  res = await req({ method: "POST", path: "/v1/route-and-invoke", headers: H() }, {
    request: { messages: [{ role: "user", content: "hi" }] }, policyDecision: "ALLOW"
  });
  show("D2 no-model 503 + Retry-After", "POST", "/v1/route-and-invoke", res);

  res = await req({ method: "POST", path: `/v1/providers/${provId}/models`, headers: H() },
    { name: "gpt-model", capabilities: ["text-generation"], sensitivityLevel: "internal" });
  show("register model 201", "POST", `/v1/providers/${provId}/models`, res);
  const modelId = JSON.parse(res.body).modelId;

  res = await req({ method: "GET", path: `/v1/providers/${provId}/models/${modelId}`, headers: H() });
  show("D1/D3 same order as JSON", "GET", `/v1/providers/${provId}/models/${modelId}`, res, "Accept: application/json");

  res = await req({ method: "GET", path: `/v1/providers/${provId}/models/${modelId}`, headers: H({ Accept: "application/xml" }) });
  show("D3 same order as XML", "GET", `/v1/providers/${provId}/models/${modelId}`, res, "Accept: application/xml");

  res = await req({ method: "GET", path: "/v1/models", headers: H({ Accept: "text/csv" }) });
  show("D3 406 cannot produce", "GET", "/v1/models", res, "Accept: text/csv");

  res = await req({ method: "POST", path: "/v1/route-and-invoke", headers: H() }, {
    request: { messages: [{ role: "user", content: "summarise" }] }, policyDecision: "ALLOW"
  });
  show("route-and-invoke 200 happy path", "POST", "/v1/route-and-invoke", res);

  require("fs").writeFileSync(__dirname + "/transcript.txt", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  svc.kill();
  process.exit(0);
})().catch((e) => { console.error(e); svc.kill(); process.exit(1); });
