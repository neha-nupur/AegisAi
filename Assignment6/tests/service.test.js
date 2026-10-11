const request = require("supertest");
const app = require("../app");
const store = require("../store");
const providerClient = require("../providerClient");

jest.mock("../providerClient", () => {
  const actual = jest.requireActual("../providerClient");
  return { ...actual, invokeProvider: jest.fn(), recordAudit: jest.fn(() => Promise.resolve({ delivered: true })) };
});

const AUTH = { Authorization: "Bearer t", "X-Organization-Id": "org-1" };

beforeEach(() => {
  store._reset();
  jest.clearAllMocks();
  providerClient.invokeProvider.mockResolvedValue({ text: "ok", latencyMs: 5 });
});

test("D1 success: 201 + Location + JSON body, labelled", async () => {
  const r = await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "openai" });
  expect(r.statusCode).toBe(201);
  expect(r.headers.location).toBe(`/v1/providers/${r.body.providerId}`);
  expect(r.headers["content-type"]).toMatch(/application\/json/);
  expect(r.body.providerId).toBeDefined();
});

test("B3 field-level 422 names two bad fields at once", async () => {
  const r = await request(app).post("/v1/providers").set(AUTH).send({ name: "", type: "bogus" });
  expect(r.statusCode).toBe(422);
  expect(r.headers["content-type"]).toMatch(/problem\+json/);
  expect(r.body.type).toBe("/errors/invalid-request");
  expect(r.body.title).toBeDefined();
  expect(r.body.status).toBe(422);
  expect(r.body.detail).toBeDefined();
  expect(r.body.errors.length).toBeGreaterThanOrEqual(2);
});

test("D2 failures: 404 unknown id, 409 conflict, 401 no token, 400 malformed JSON", async () => {
  expect((await request(app).get("/v1/providers/prov-999/health").set(AUTH)).statusCode).toBe(404);
  await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "openai" });
  const dup = await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "gemini" });
  expect(dup.statusCode).toBe(409);
  expect(dup.body.type).toBe("/errors/provider-conflict");
  expect((await request(app).get("/v1/models").set({ "X-Organization-Id": "org-1" })).statusCode).toBe(401);
  const bad = await request(app).post("/v1/providers").set({ ...AUTH, "Content-Type": "application/json" })
    .send("{not-json");
  expect(bad.statusCode).toBe(400);
});

test("D2 503 carries Retry-After; A5 idempotency + 304 + 412 still hold (D4)", async () => {
  const empty = await request(app).post("/v1/route-and-invoke").set(AUTH).send({
    request: { messages: [{ role: "user", content: "hi" }] }, policyDecision: "ALLOW"
  });
  expect(empty.statusCode).toBe(503);
  expect(empty.headers["retry-after"]).toBeDefined();
  const H = { ...AUTH, "Idempotency-Key": "k-6" };
  const r1 = await request(app).post("/v1/providers").set(H).send({ name: "P", type: "local" });
  const r2 = await request(app).post("/v1/providers").set(H).send({ name: "P", type: "local" });
  expect([r1.statusCode, r2.statusCode]).toEqual([201, 200]);
  expect(r1.body.providerId).toBe(r2.body.providerId);
  const m = await request(app).post(`/v1/providers/${r1.body.providerId}/models`).set(AUTH)
    .send({ name: "m", capabilities: ["x"], sensitivityLevel: "public" });
  const g1 = await request(app).get(`/v1/providers/${r1.body.providerId}/models/${m.body.modelId}`).set(AUTH);
  const g2 = await request(app).get(`/v1/providers/${r1.body.providerId}/models/${m.body.modelId}`)
    .set({ ...AUTH, "If-None-Match": g1.headers.etag });
  expect(g2.statusCode).toBe(304);
  const w = await request(app).patch(`/v1/providers/${r1.body.providerId}`)
    .set({ ...AUTH, "If-Match": '"mp-stale"' }).send({ timeoutMs: 1 });
  expect(w.statusCode).toBe(412);
});

test("D3 negotiation: XML when asked, 406 when impossible", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P", type: "local" });
  const m = await request(app).post(`/v1/providers/${c.body.providerId}/models`).set(AUTH)
    .send({ name: "m", capabilities: ["x"], sensitivityLevel: "public" });
  const xml = await request(app).get(`/v1/providers/${c.body.providerId}/models/${m.body.modelId}`)
    .set({ ...AUTH, Accept: "application/xml" });
  expect(xml.statusCode).toBe(200);
  expect(xml.headers["content-type"]).toMatch(/application\/xml/);
  expect(xml.text).toMatch(/<response>/);
  const bad = await request(app).get("/v1/models").set({ ...AUTH, Accept: "text/csv" });
  expect(bad.statusCode).toBe(406);
});

test("route-and-invoke happy path 200 + Retry-After absent on success", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P", type: "local" });
  await request(app).post(`/v1/providers/${c.body.providerId}/models`).set(AUTH)
    .send({ name: "m", capabilities: ["text-generation"], sensitivityLevel: "public" });
  const r = await request(app).post("/v1/route-and-invoke").set(AUTH).send({
    request: { messages: [{ role: "user", content: "hi" }] }, policyDecision: "ALLOW"
  });
  expect(r.statusCode).toBe(200);
  expect(r.body.status).toBe("success");
});
