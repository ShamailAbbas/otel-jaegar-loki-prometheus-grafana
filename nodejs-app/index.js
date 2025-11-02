require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { initializeOpenTelemetry, getLogger } = require("./telemetry");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { simulateTraffic } = require("./simulateTraffic");

// Initialize OpenTelemetry
const sdk = initializeOpenTelemetry();
const logger = getLogger();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.emit({ severityText: "INFO", body: "SIGTERM received, shutting down gracefully..." });
  await sdk.shutdown();
  process.exit(0);
});

// Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Metrics + Logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Already recorded in telemetry.js via simulateTraffic
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
  console.log(`📡 OpenTelemetry enabled for traces, metrics, and logs`);
  logger.emit({
    severityText: "INFO",
    body: `Server started on port ${PORT}`,
    attributes: { env: process.env.NODE_ENV || "development" },
  });

  // Start continuous traffic simulation
  startContinuousTraffic();
});

// Continuous traffic function
function startContinuousTraffic() {
  const minDelay = 500;   // Minimum delay between requests in ms
  const maxDelay = 3000;  // Maximum delay between requests in ms
  const maxConcurrent = 5; // Max concurrent requests at a time

  const endpoints = [
    { method: "get", path: "/" },
    { method: "get", path: "/health" },
    { method: "get", path: "/users" },
    { method: "get", path: "/users/1" },
    { method: "get", path: "/users/999" }, // simulate 404
    { method: "get", path: "/profiles" },
    { method: "post", path: "/users", data: { name: "SimUser", email: "sim@example.com" } },
    { method: "put", path: "/users/1", data: { name: "UpdatedSimUser" } },
    { method: "delete", path: "/users/999" }, // simulate 404
  ];

  async function randomRequest() {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    try {
      await simulateTraffic(1, 0, [ep]); // Call simulateTraffic for a single endpoint
    } catch (err) {
      console.error("Error in simulated request:", err.message);
    } finally {
      // Schedule the next random request
      setTimeout(randomRequest, delay);
    }
  }

  // Start multiple concurrent random requests
  for (let i = 0; i < maxConcurrent; i++) {
    randomRequest();
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  logger.emit({
    severityText: "ERROR",
    body: `Unhandled Promise Rejection: ${err.message}`,
    attributes: { stack: err.stack },
  });

  server.close(async () => {
    await sdk.shutdown();
    process.exit(1);
  });
});

module.exports = app;
