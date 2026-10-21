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

  test("accepts a name with exactly 100 characters", async () => {
    const response = await request(app)
      .post("/users")
      .send({
        name: "A".repeat(100),
        email: "boundary@example.com",
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toHaveLength(100);
  });

  test("accepts a padded name that trims to 100 characters", async () => {
    const response = await request(app)
      .post("/users")
      .send({
        name: ` ${"A".repeat(100)} `,
        email: "padded@example.com",
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toHaveLength(100);
  });
  test("trims email whitespace and detects duplicates", async () => {
    const first = await request(app).post("/users").send({
      name: "First",
      email: " test@example.com ",
    });

    expect(first.status).toBe(201);
    expect(first.body.email).toBe("test@example.com");

    const second = await request(app).post("/users").send({
      name: "Second",
      email: "test@example.com",
    });

    expect(second.status).toBe(409);
  });
  test("rejects request bodies larger than 10kb with JSON", async () => {
    const response = await request(app)
      .post("/users")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          name: "A".repeat(11000),
          email: "test@example.com",
        }),
      );

    expect(response.status).toBe(413);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body.error).toBe("Request body is too large");
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

  test("accepts the maximum page size of 100", async () => {
    const response = await request(app).get("/users?limit=100");

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(100);
  });

  test.each(["101", "abc", "0"])("rejects invalid limit: %s", async (limit) => {
    const response = await request(app).get(`/users?limit=${limit}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  test("rejects fractional page numbers", async () => {
    const response = await request(app).get("/users?page=1.5");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  test("rejects invalid pagination parameters", async () => {
    const response = await request(app).get("/users?page=0&limit=10");

    expect(response.status).toBe(400);
  });
});
describe("PUT /users/:id", () => {
  beforeEach(() => {
    app.locals.users.length = 0;
  });

  const createUser = async (name, email) => {
    return request(app).post("/users").send({ name, email });
  };

  test("updates a user's name and email successfully", async () => {
    await createUser("Pradnya", "old@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({ name: "Updated Name", email: "NEW@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      name: "Updated Name",
      email: "new@example.com",
    });
  });

  test("returns 404 when the user does not exist", async () => {
    const response = await request(app)
      .put("/users/999")
      .send({ name: "Test", email: "test@example.com" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("User not found");
  });

  test("returns 400 for an invalid user ID", async () => {
    const response = await request(app)
      .put("/users/abc")
      .send({ name: "Test", email: "test@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid user ID");
  });

  test("returns 400 when required fields are missing", async () => {
    await createUser("Pradnya", "old@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({ name: "Updated Name" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Name and email are required");
  });

  test("returns 400 for an invalid email", async () => {
    await createUser("Pradnya", "old@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({ name: "Updated Name", email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("A valid email address is required");
  });

  test("returns 400 when the name exceeds 100 characters", async () => {
    await createUser("Pradnya", "old@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({ name: "A".repeat(101), email: "new@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Name must be between 1 and 100 characters",
    );
  });

  test("returns 409 when the email belongs to another user", async () => {
    await createUser("User One", "one@example.com");
    await createUser("User Two", "two@example.com");
    const originalUser = { ...app.locals.users[0] };
    const response = await request(app).put("/users/1").send({
      name: "Updated User",
      email: "TWO@Example.com",
    });

    expect(response.status).toBe(409);
    expect(app.locals.users[0]).toEqual(originalUser);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Email already exists");
  });

  test("allows keeping the same email when updating the name", async () => {
    await createUser("Pradnya", "pradnya@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({ name: "Updated Name", email: "pradnya@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Name");
    expect(response.body.email).toBe("pradnya@example.com");
  });

  test.each([
    ["whitespace-only name", { name: "   ", email: "updated@example.com" }],
    ["numeric name", { name: 123, email: "updated@example.com" }],
    ["null name", { name: null, email: "updated@example.com" }],
    ["numeric email", { name: "Updated User", email: 123 }],
    ["null email", { name: "Updated User", email: null }],
    ["empty body", {}],
    [
      "name exceeding 100 characters",
      { name: "A".repeat(101), email: "updated@example.com" },
    ],
    [
      "email exceeding 254 characters",
      { name: "Updated User", email: `${"a".repeat(243)}@example.com` },
    ],
  ])("returns 400 for %s", async (_case, body) => {
    await createUser("Original Name", "old@example.com");
    const originalUser = { ...app.locals.users[0] };

    const response = await request(app)
      .put("/users/1")
      .send(body);

    expect(response.status).toBe(400);
    expect(app.locals.users[0]).toEqual(originalUser);
  });

  test("accepts a padded name that trims to 100 characters", async () => {
    await createUser("Original Name", "old@example.com");

    const response = await request(app)
      .put("/users/1")
      .send({
        name: ` ${"A".repeat(100)} `,
        email: "updated@example.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("A".repeat(100));
  });

  
  
  ("PUT /users/:id returns 400 for %s", async (_case, body) => {
    const response = await request(app).put("/users/1").send({
      name: "Updated User",
      email: "TWO@Example.com",
    });

    expect(response.status).toBe(400);
  });
});
