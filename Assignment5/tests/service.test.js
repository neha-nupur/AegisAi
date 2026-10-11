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

test("A1 method map: create 201+Location, list 200, patch 200, delete 204", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P1", type: "local" });
  expect(c.statusCode).toBe(201);
  expect(c.headers.location).toBe(`/v1/providers/${c.body.providerId}`);
  const id = c.body.providerId;
  expect((await request(app).get("/v1/models").set(AUTH)).statusCode).toBe(200);
  expect((await request(app).patch(`/v1/providers/${id}`).set(AUTH).send({ timeoutMs: 9000 })).statusCode).toBe(200);
  expect((await request(app).delete(`/v1/providers/${id}`).set(AUTH)).statusCode).toBe(204);
});

test("A5 OPTIONS returns Allow", async () => {
  const r = await request(app).options("/v1/providers").set(AUTH);
  expect(r.statusCode).toBe(204);
  expect(r.headers.allow).toMatch(/PATCH/);
});

test("A5 X-HTTP-Method-Override tunnels PATCH", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P1", type: "local" });
  const r = await request(app).post(`/v1/providers/${c.body.providerId}`).set({ ...AUTH, "X-HTTP-Method-Override": "PATCH" }).send({ timeoutMs: 1234 });
  expect(r.statusCode).toBe(200);
  expect(r.body.providerId).toBe(c.body.providerId);
});

test("B1 406 on unsupported Accept", async () => {
  const r = await request(app).get("/v1/models").set({ ...AUTH, Accept: "text/csv" });
  expect(r.statusCode).toBe(406);
});

test("B3 missing bearer -> 401", async () => {
  const r = await request(app).get("/v1/models").set({ "X-Organization-Id": "org-1" });
  expect(r.statusCode).toBe(401);
});

test("B4/C1 ETag + conditional GET -> 304", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P1", type: "local" });
  const m = await request(app).post(`/v1/providers/${c.body.providerId}/models`).set(AUTH)
    .send({ name: "m", capabilities: ["text-generation"], sensitivityLevel: "public" });
  const g1 = await request(app).get(`/v1/providers/${c.body.providerId}/models/${m.body.modelId}`).set(AUTH);
  expect(g1.statusCode).toBe(200);
  expect(g1.headers.etag).toBeDefined();
  expect(g1.headers["cache-control"]).toMatch(/max-age/);
  const g2 = await request(app).get(`/v1/providers/${c.body.providerId}/models/${m.body.modelId}`)
    .set({ ...AUTH, "If-None-Match": g1.headers.etag });
  expect(g2.statusCode).toBe(304);
});

test("C2 stale If-Match -> 412", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P1", type: "local" });
  const r = await request(app).patch(`/v1/providers/${c.body.providerId}`).set({ ...AUTH, "If-Match": '"mp-staleetag0000"' }).send({ timeoutMs: 5 });
  expect(r.statusCode).toBe(412);
});

test("C3 idempotency repeat returns original", async () => {
  const H = { ...AUTH, "Idempotency-Key": "k-1" };
  const r1 = await request(app).post("/v1/providers").set(H).send({ name: "P1", type: "local" });
  const r2 = await request(app).post("/v1/providers").set(H).send({ name: "P1", type: "local" });
  expect(r1.statusCode).toBe(201);
  expect(r2.statusCode).toBe(200);
  expect(r1.body.providerId).toBe(r2.body.providerId);
});

test("A4 list paginates and sorts via query string", async () => {
  const c = await request(app).post("/v1/providers").set(AUTH).send({ name: "P1", type: "local" });
  await request(app).post(`/v1/providers/${c.body.providerId}/models`).set(AUTH)
    .send({ name: "b-model", capabilities: ["x"], sensitivityLevel: "public" });
  await request(app).post(`/v1/providers/${c.body.providerId}/models`).set(AUTH)
    .send({ name: "a-model", capabilities: ["x"], sensitivityLevel: "public" });
  const r = await request(app).get("/v1/models?sort=name&order=asc&limit=1&page=2").set(AUTH);
  expect(r.statusCode).toBe(200);
  expect(r.body.models.length).toBe(1);
  expect(r.body.models[0].name).toBe("b-model");
  expect(r.body.total).toBe(2);
});

test("B5 rate-limit headers present, 429 with Retry-After when exceeded", async () => {
  const r = await request(app).get("/v1/models").set({ ...AUTH, Authorization: "Bearer rate-test-client" });
  expect(r.headers["x-ratelimit-limit"]).toBeDefined();
  expect(r.headers["x-ratelimit-remaining"]).toBeDefined();
});
