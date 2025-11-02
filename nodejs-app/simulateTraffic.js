const axios = require("axios");
const { getLogger, recordHttpRequest } = require("./telemetry");

const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

function randomStatusOverride(originalStatus) {
  const rnd = Math.random();
  if (rnd < 0.1) return 500; // 10% server error
  if (rnd < 0.2) return 400; // 10% client error
  return originalStatus; // else normal
}

async function simulateTraffic(iterations = 5, delayMs = 1000, customEndpoints = null) {
  // Get logger safely
  let logger;
  try {
    logger = getLogger();
  } catch (err) {
    console.error("Logger not available:", err.message);
    return;
  }

  // Default endpoints if none provided
  const endpoints = customEndpoints || [
    { method: "get", path: "/" },
    { method: "get", path: "/health" },
    { method: "get", path: "/users" },
    { method: "get", path: "/users/1" },
    { method: "get", path: "/users/999" }, // simulate 404
    { method: "get", path: "/profiles" },
    { method: "post", path: "/users", data: { name: "TestUser", email: "test@example.com" } },
    { method: "put", path: "/users/1", data: { name: "UpdatedUser" } },
    { method: "delete", path: "/users/999" }, // simulate 404
  ];

  for (let i = 0; i < iterations; i++) {
    for (const ep of endpoints) {
      const start = Date.now();
      let status;

      try {
        // Simulate occasional network errors
        const simulateNetworkError = Math.random() < 0.05; // 5% network failure
        if (simulateNetworkError) {
          throw new Error("Simulated network failure");
        }

        const res = await axios({
          method: ep.method,
          url: baseUrl + ep.path,
          data: ep.data || undefined,
          timeout: 5000,
          validateStatus: () => true, // Accept all status codes
        });

        status = randomStatusOverride(res.status);

        recordHttpRequest({
          method: ep.method.toUpperCase(),
          route: ep.path,
          status,
          duration: Date.now() - start,
        });

        logger.emit({
          severityText: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
          body: `[SIMULATOR] ${ep.method.toUpperCase()} ${ep.path} => ${status}`,
          attributes: {
            method: ep.method.toUpperCase(),
            route: ep.path,
            status,
            duration: Date.now() - start
          },
        });
      } catch (err) {
        status = err.response?.status || 500;
        const duration = Date.now() - start;

        recordHttpRequest({
          method: ep.method.toUpperCase(),
          route: ep.path,
          status,
          duration,
        });

        logger.emit({
          severityText: "ERROR",
          body: `[SIMULATOR] ${ep.method.toUpperCase()} ${ep.path} failed: ${err.message}`,
          attributes: {
            method: ep.method.toUpperCase(),
            route: ep.path,
            status,
            duration,
            error: err.message
          },
        });
      }
    }

    // Wait between iterations (unless delayMs is 0)
    if (delayMs > 0 && i < iterations - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { simulateTraffic };
