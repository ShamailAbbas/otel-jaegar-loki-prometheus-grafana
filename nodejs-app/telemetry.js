require("dotenv").config();
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { Resource } = require("@opentelemetry/resources");
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = require("@opentelemetry/semantic-conventions");
const { metrics } = require("@opentelemetry/api");

let httpCounter;

function initializeOpenTelemetry() {
  const serviceName = process.env.SERVICE_NAME || "express-app";
  const serviceVersion = process.env.SERVICE_VERSION || "1.0.0";
  const collectorUrl = process.env.OTEL_COLLECTOR_URL || "grpc://otel-collector.observability.svc.cluster.local:4317";

  // Create resource with service information
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  });

  // Trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: collectorUrl,
  });

  // Metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: collectorUrl,
  });

  // Metrics reader
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: parseInt(process.env.METRICS_INTERVAL_MS || "10000", 10),
  });

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false, // Disable fs instrumentation to reduce noise
        },
      }),
    ],
  });

  sdk.start();
  console.log("✅ OpenTelemetry initialized");

  // Create custom metrics
  const meter = metrics.getMeter(serviceName);
  httpCounter = meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  });

  return sdk;
}

function getHttpCounter() {
  return httpCounter;
}

module.exports = {
  initializeOpenTelemetry,
  getHttpCounter,
};
