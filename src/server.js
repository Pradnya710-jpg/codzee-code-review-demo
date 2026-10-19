const express = require("express");
const app = express();
app.use(express.json({ limit: "10kb" }));
const users = [];
app.locals.users = users;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post("/users", (req, res, next) => {
  try {
    const { name, email } = req.body || {};

    if (typeof name !== "string" || typeof email !== "string") {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || normalizedName.length > 100) {
      return res.status(400).json({
        error: "Name must be between 1 and 100 characters",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !EMAIL_REGEX.test(normalizedEmail)
    ) {
      return res.status(400).json({
        error: "A valid email address is required",
      });
    }

    const existingUser = users?.find(
      (user) => user.email === normalizedEmail
    );

    if (existingUser) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    const user = {
      id: users.length + 1,
      name: normalizedName,
      email: normalizedEmail,
    };

    users.push(user);

    return res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});


app.get("/users", (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      error: "Page must be positive and limit must be between 1 and 100",
    });
  }

  const startIndex = (page - 1) * limit;

  const data = users
    .slice(startIndex, startIndex + limit)
    .map(({ id, name }) => ({ id, name }));

  return res.json({
    data,
    pagination: {
      page,
      limit,
      total: users.length,
      totalPages: Math.ceil(users.length / limit),
    },
  });
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON request body",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large",
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "Internal server error",
  });
});
if (require.main === module) {
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
}

module.exports = app;;