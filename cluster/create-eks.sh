#!/bin/bash
CLUSTER_NAME="dev-eks"
REGION="us-east-1"
NODE_TYPE="t3.medium"
NODES=3

# Create EKS cluster with managed nodes
eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --nodegroup-name standard-workers \
  --node-type $NODE_TYPE \
  --nodes $NODES \
  --nodes-min 3 \
  --nodes-max 6 \
  --managed \
  --with-oidc

aws eks update-kubeconfig --region ${REGION} --name ${CLUSTER_NAME}
kubectl get nodes
