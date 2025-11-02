#!/bin/bash

set -e

echo "==== Deploying namespace and storage class ===="
kubectl apply -f deploy/namespace.yaml
kubectl apply -f deploy/storageclass.yaml

sleep 5

echo "==== Adding Helm repositories ===="
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

echo "==== Installing Loki ===="
helm install loki grafana/loki \
  --namespace observability \
  --version 6.29.0 \
  -f deploy/loki/loki-values.yaml



echo "==== Deploying OpenTelemetry Collector ===="
kubectl apply -f deploy/otel-collector/



echo "==== Installing Jaeger ===="
helm install jaeger jaegertracing/jaeger \
  --namespace observability \
  -f deploy/jaeger/jaeger-values.yaml


echo "==== Installing kube-prometheus-stack ===="
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability -f deploy/kube-prometheus-stack/values.yaml


echo "==== Deploying applications ===="
kubectl apply -f deploy/apps/



# echo "==== Deployment complete! Starting port-forwards... ===="
# kubectl port-forward svc/prometheus-grafana 7070:80 -n observability &
# kubectl port-forward svc/jaeger-query 8080:80 -n observability &
# kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n observability &
# echo "====  Access Grafana at http://localhost:7070, Jaeger at http://localhost:8080, Prometheus at http://localhost:9090 ===="
