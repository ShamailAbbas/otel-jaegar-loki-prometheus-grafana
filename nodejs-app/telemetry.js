const { metrics, logs } = require("@opentelemetry/api");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { PeriodicExportingMetricReader, Histogram } = require("@opentelemetry/sdk-metrics");
const { LoggerProvider, BatchLogRecordProcessor } = require("@opentelemetry/sdk-logs");
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-grpc");
const { Resource } = require("@opentelemetry/resources");
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = require("@opentelemetry/semantic-conventions");

let sdk;
let logger;
let httpCounter, errorCounter, httpDurationHistogram;

function initializeOpenTelemetry() {
  const serviceName = process.env.SERVICE_NAME || "express-app";
  const serviceVersion = process.env.SERVICE_VERSION || "1.0.0";
  const collectorUrl = process.env.OTEL_COLLECTOR_URL || "grpc://otel-collector.observability.svc.cluster.local:4317";

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  });

  // Traces
  const traceExporter = new OTLPTraceExporter({ url: collectorUrl });

  // Metrics
  const metricExporter = new OTLPMetricExporter({ url: collectorUrl });
  const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 5000 });

  // Logs
  const logExporter = new OTLPLogExporter({ url: collectorUrl });
  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);
  logger = logs.getLogger(serviceName);

  // Initialize SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  console.log("✅ OpenTelemetry initialized (traces + metrics + logs)");

  // ---- Metrics ----
  const meter = metrics.getMeter(serviceName);

  // Total HTTP requests
  httpCounter = meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  });

  // HTTP errors (4xx/5xx)
  errorCounter = meter.createCounter("http_errors_total", {
    description: "Total number of failed HTTP requests",
  });

  // Request duration histogram (ms)
  httpDurationHistogram = meter.createHistogram("http_request_duration_ms", {
    description: "Histogram of HTTP request durations in ms",
  });

  return sdk;
}

function recordHttpRequest({ method, route, status, duration }) {
  httpCounter.add(1, { method, route, status: status.toString() });
  httpDurationHistogram.record(duration, { method, route, status: status.toString() });

  if (status >= 400) {
    errorCounter.add(1, { method, route, status: status.toString() });
  }
}

function getLogger() {
  return logger;
}

module.exports = {
  initializeOpenTelemetry,
  recordHttpRequest,
  getLogger,
  sdk,
};
