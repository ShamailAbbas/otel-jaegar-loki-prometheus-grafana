require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");

// ---- OpenTelemetry Setup ----
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");

// ---- Trace Exporter ----
const traceExporter = new OTLPTraceExporter({
  url: "grpc://otel-collector.observability.svc.cluster.local:4317",
});

// ---- Metric Exporter ----
const metricExporter = new OTLPMetricExporter({
  url: "grpc://otel-collector.observability.svc.cluster.local:4317",
});

// ---- Metrics Reader ----
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 10000, // send metrics every 10 seconds
});

// ---- NodeSDK Initialization ----
const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  metricReader, // attach metrics reader
});

sdk.start();

// ---- Express App ----
const app = express();
app.use(bodyParser.json());
app.use(morgan("combined"));

// ---- Custom Middleware to simulate metrics ----
const { metrics } = require("@opentelemetry/api");
const meter = metrics.getMeter("my-app");
const httpCounter = meter.createCounter("http_requests_total", {
  description: "Total number of HTTP requests",
});

app.use((req, res, next) => {
  res.on("finish", () => {
    httpCounter.add(1, { method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

// ---- Endpoints ----
app.get("/", (req, res) => {
  res.send("Hello from Node.js + OpenTelemetry!");
});

app.get("/users", (req, res) => {
  res.json([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]);
});

app.post("/users", (req, res) => {
  const user = req.body;
  user.id = Math.floor(Math.random() * 1000);
  res.status(201).json(user);
});

app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const user = req.body;
  user.id = parseInt(id);
  res.json(user);
});

app.delete("/users/:id", (req, res) => {
  res.status(204).send();
});

// ---- Optional Health Endpoint ----
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App running on port ${PORT}`));
