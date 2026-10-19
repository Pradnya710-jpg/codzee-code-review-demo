const express = require("express");
const app = express();
app.use(express.json());
const users = [];
app.post("/users", (req, res) => {
  const { name, email } = req.body || {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim()
  ) {
    return res.status(400).json({
      error: "Name and email are required",
    });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = users.find((user) => user.email === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({
      error: "Email already exists",
    });
  }
  const user = {
    id: users.length + 1,
    name: name.trim(),
    email: normalizedEmail,
  };
  users.push(user);
  return res.status(201).json(user);
});

app.get("/users", (_req, res) => {
  res.json(users);
});
if (require.main === module) {
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
}
module.exports = app;