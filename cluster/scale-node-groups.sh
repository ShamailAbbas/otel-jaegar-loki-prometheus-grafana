#!/bin/bash
CLUSTER_NAME="dev-eks"
REGION="us-east-1"

eksctl scale nodegroup \
  --cluster $CLUSTER_NAME \
  --name standard-workers \
  --nodes 5 \
  --region $REGION
