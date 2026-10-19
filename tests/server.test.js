
const request = require("supertest");
const app = require("../src/server");

beforeEach(() => {
  app.locals.users.length = 0;
});

describe("POST /users", () => {
  test("creates a user and normalizes the email", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: " Pradnya ", email: "PRADNYA@example.com" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Pradnya");
    expect(response.body.email).toBe("pradnya@example.com");
  });

  test("rejects missing fields", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: "Pradnya" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  test("rejects invalid email addresses", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: "Pradnya", email: "a b@@c" });

    expect(response.status).toBe(400);
  });

  test("rejects names longer than 100 characters", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: "A".repeat(101), email: "a@example.com" });

    expect(response.status).toBe(400);
  });

  test("rejects duplicate emails regardless of capitalization", async () => {
    await request(app)
      .post("/users")
      .send({ name: "First", email: "test@example.com" });

    const response = await request(app)
      .post("/users")
      .send({ name: "Second", email: "TEST@example.com" });

    expect(response.status).toBe(409);
  });

  test("returns JSON for malformed request bodies", async () => {
    const response = await request(app)
      .post("/users")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body.error).toBe("Invalid JSON request body");
  });
});

describe("GET /users", () => {
  test("returns public fields only and supports pagination", async () => {
    await request(app)
      .post("/users")
      .send({ name: "First", email: "first@example.com" });

    await request(app)
      .post("/users")
      .send({ name: "Second", email: "second@example.com" });

    const response = await request(app).get("/users?page=1&limit=1");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({ id: 1, name: "First" });
    expect(response.body.data[0]).not.toHaveProperty("email");
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.pagination.totalPages).toBe(2);
  });

  test("rejects invalid pagination parameters", async () => {
    const response = await request(app).get("/users?page=0&limit=10");

    expect(response.status).toBe(400);
  });
});
