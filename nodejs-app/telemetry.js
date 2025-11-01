require("dotenv").config();

const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");

const { Resource } = require("@opentelemetry/resources");
const {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} = require("@opentelemetry/semantic-conventions");

const { metrics } = require("@opentelemetry/api");

// ---- Added for logs ----
const { logs } = require("@opentelemetry/api-logs");
const {
  LoggerProvider,
  BatchLogRecordProcessor,
} = require("@opentelemetry/sdk-logs");
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-grpc");
// -------------------------

let httpCounter;
let logger;

function initializeOpenTelemetry() {
  const serviceName = process.env.SERVICE_NAME || "express-app";
  const serviceVersion = process.env.SERVICE_VERSION || "1.0.0";
  const collectorUrl =
    process.env.OTEL_COLLECTOR_URL ||
    "grpc://otel-collector.observability.svc.cluster.local:4317";

  // Create resource with service metadata
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  });

  // ---- Traces ----
  const traceExporter = new OTLPTraceExporter({
    url: collectorUrl,
  });

  // ---- Metrics ----
  const metricExporter = new OTLPMetricExporter({
    url: collectorUrl,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: parseInt(
      process.env.METRICS_INTERVAL_MS || "10000",
      10
    ),
  });

  // ---- Logs ----
  const logExporter = new OTLPLogExporter({
    url: collectorUrl,
  });

  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);

  logger = logs.getLogger(serviceName);

  // ---- Initialize SDK ----
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false, // disable fs instrumentation to reduce noise
        },
      }),
    ],
  });

  sdk.start();
  console.log("✅ OpenTelemetry initialized (traces + metrics + logs)");

  // ---- Custom metric example ----
  const meter = metrics.getMeter(serviceName);
  httpCounter = meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  });

  // ---- Test log ----
  logger.emit({
    severityText: "INFO",
    body: "OpenTelemetry logging initialized and connected to collector.",
  });

  return sdk;
}

function getHttpCounter() {
  return httpCounter;
}

function getLogger() {
  return logger;
}

module.exports = {
  initializeOpenTelemetry,
  getHttpCounter,
  getLogger,
};
