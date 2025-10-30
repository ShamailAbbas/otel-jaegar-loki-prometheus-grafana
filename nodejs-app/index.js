require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { initializeOpenTelemetry, getHttpCounter } = require("./telemetry");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Initialize OpenTelemetry before any other code
const sdk = initializeOpenTelemetry();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await sdk.shutdown();
  process.exit(0);
});

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const counter = getHttpCounter();

    counter.add(1, {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
});

// Routes
app.use("/", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📡 OpenTelemetry enabled`);
});

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  server.close(async () => {
    await sdk.shutdown();
    process.exit(1);
  });
});

module.exports = app;
