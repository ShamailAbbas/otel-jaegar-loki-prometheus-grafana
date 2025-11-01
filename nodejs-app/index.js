require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const { initializeOpenTelemetry, getHttpCounter, getLogger } = require("./telemetry");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Initialize OpenTelemetry before any other code
const sdk = initializeOpenTelemetry();
const logger = getLogger();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.emit({ severityText: "INFO", body: "SIGTERM received, shutting down gracefully..." });
  await sdk.shutdown();
  process.exit(0);
});

// Create Express app
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
    const counter = getHttpCounter();

    // Record metrics
    counter.add(1, {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      duration_ms: duration,
    });

    // Emit logs via OpenTelemetry
    logger.emit({
      severityText: res.statusCode >= 500 ? "ERROR" : "INFO",
      body: `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      attributes: {
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode,
        duration_ms: duration,
      },
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
  console.log(`📡 OpenTelemetry enabled for traces, metrics, and logs`);
  logger.emit({
    severityText: "INFO",
    body: `Server started on port ${PORT}`,
    attributes: { env: process.env.NODE_ENV || "development" },
  });
});

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
