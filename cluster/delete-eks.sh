#!/bin/bash
CLUSTER_NAME="dev-eks"
REGION="us-east-1"

eksctl delete cluster --name $CLUSTER_NAME --region $REGION
