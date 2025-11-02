const express = require("express");
const router = express.Router();

// In-memory user store (replace with database in production)
let users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

let profiles = [
  { id: 1, name: "Alice Profile", email: "alice@example.com" },
  { id: 2, name: "Bob Profile", email: "bob@example.com" },
];

// Root endpoint
router.get("/", (req, res) => {
  res.json({
    message: "Hello from Node.js + OpenTelemetry!",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      users: "/users",
    },
  });
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Get all users
router.get("/users", (req, res) => {
  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});
router.get("/profiles", (req, res) => {
  res.json({
    success: true,
    count: profiles.length,
    data: profiles,
  });
});

// Get user by ID
router.get("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: `User with id ${id} not found`,
    });
  }

  res.json({
    success: true,
    data: user,
  });
});

// Create new user
router.post("/users", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: "Name and email are required",
    });
  }

  const newUser = {
    id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
    name,
    email,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: newUser,
  });
});

// Update user
router.put("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, email } = req.body;
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `User with id ${id} not found`,
    });
  }

  users[userIndex] = {
    ...users[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    message: "User updated successfully",
    data: users[userIndex],
  });
});

// Delete user
router.delete("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `User with id ${id} not found`,
    });
  }

  users.splice(userIndex, 1);

  res.status(204).send();
});

module.exports = router;
