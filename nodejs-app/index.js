const express = require("express");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");

const exporter = new OTLPTraceExporter({
  url: "grpc://otel-collector.observability.svc.cluster.local:4317",
});

const sdk = new NodeSDK({
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();
app.get("/", (req, res) => {
  res.send("Hello from Node.js + OpenTelemetry!");
});

app.listen(3000, () => console.log("App running on port 3000"));
