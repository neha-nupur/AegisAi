const request = require("supertest");
const app = require("../app");
const store = require("../store");
const providerClient = require("../providerClient");

jest.mock("../providerClient", () => {
  const actual = jest.requireActual("../providerClient");
  return { ...actual, invokeProvider: jest.fn(), recordAudit: jest.fn(() => Promise.resolve({ delivered: true })) };
});

const AUTH = { Authorization: "Bearer test-token", "X-Organization-Id": "org-1" };

beforeEach(() => {
  store._reset();
  jest.clearAllMocks();
  providerClient.invokeProvider.mockResolvedValue({ text: "hello from mock", latencyMs: 12 });
});

async function seed() {
  const p = await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "openai" });
  const provId = p.body.providerId;
  const m = await request(app).post(`/v1/providers/${provId}/models`).set(AUTH).send({
    name: "gpt-model", capabilities: ["text-generation", "summarization"], sensitivityLevel: "internal"
  });
  return { provId, modelId: m.body.modelId };
}

test("create provider returns 201 with Location header", async () => {
  const res = await request(app).post("/v1/providers").set(AUTH).send({ name: "Gemini", type: "gemini" });
  expect(res.statusCode).toBe(201);
  expect(res.body.providerId).toBeDefined();
  expect(res.headers.location).toBe(`/v1/providers/${res.body.providerId}`);
});

test("same Idempotency-Key returns original without duplicating", async () => {
  const headers = { ...AUTH, "Idempotency-Key": "k-99" };
  const r1 = await request(app).post("/v1/providers").set(headers).send({ name: "OpenAI", type: "openai" });
  const r2 = await request(app).post("/v1/providers").set(headers).send({ name: "OpenAI", type: "openai" });
  expect(r1.statusCode).toBe(201);
  expect(r2.statusCode).toBe(200);
  expect(r1.body.providerId).toBe(r2.body.providerId);
});

test("duplicate provider name returns 409 state conflict", async () => {
  await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "openai" });
  const res = await request(app).post("/v1/providers").set(AUTH).send({ name: "OpenAI", type: "gemini" });
  expect(res.statusCode).toBe(409);
  expect(res.body.type).toBe("/errors/provider-conflict");
});

test("malformed body is rejected with 400", async () => {
  const res = await request(app).post("/v1/providers").set(AUTH).send({ name: "" });
  expect(res.statusCode).toBe(400);
  expect(res.body.type).toBe("/errors/invalid-request");
});

test("unknown provider returns 404", async () => {
  const res = await request(app).get("/v1/providers/prov-999/health").set(AUTH);
  expect(res.statusCode).toBe(404);
});

test("route-and-invoke returns 200 with modelUsed and providerId", async () => {
  const { modelId, provId } = await seed();
  const res = await request(app).post("/v1/route-and-invoke").set(AUTH).send({
    request: { requestId: "req-1", messages: [{ role: "user", content: "summarise this" }] },
    policyDecision: "ALLOW"
  });
  expect(res.statusCode).toBe(200);
  expect(res.body.modelUsed).toBe(modelId);
  expect(res.body.providerId).toBe(provId);
  expect(res.body.status).toBe("success");
});

test("filtered list by capability works", async () => {
  await seed();
  const res = await request(app).get("/v1/models?capability=summarization").set(AUTH);
  expect(res.statusCode).toBe(200);
  expect(res.body.models.length).toBe(1);
});
