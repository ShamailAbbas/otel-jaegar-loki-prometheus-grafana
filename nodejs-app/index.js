require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { initializeOpenTelemetry, getLogger } = require("./telemetry");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { simulateTraffic } = require("./simulateTraffic");

// Initialize OpenTelemetry FIRST
const sdk = initializeOpenTelemetry();

// Get logger AFTER initialization
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

  // Start continuous traffic simulation after server is ready
  // Add small delay to ensure server is fully initialized
  setTimeout(() => {
    startContinuousTraffic();
  }, 2000);
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

  let isShuttingDown = false;

  async function randomRequest() {
    if (isShuttingDown) return;

    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    try {
      // Pass single endpoint as array
      await simulateTraffic(1, 0, [ep]);
    } catch (err) {
      console.error("Error in simulated request:", err.message);
    } finally {
      // Schedule the next random request
      if (!isShuttingDown) {
        setTimeout(randomRequest, delay);
      }
    }
  }

  // Start multiple concurrent random requests
  for (let i = 0; i < maxConcurrent; i++) {
    setTimeout(() => randomRequest(), i * 200); // Stagger initial requests
  }

  // Stop simulation on shutdown
  process.on("SIGTERM", () => {
    isShuttingDown = true;
  });
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
