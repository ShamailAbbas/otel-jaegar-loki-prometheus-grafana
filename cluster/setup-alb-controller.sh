#!/bin/bash
set -euo pipefail

##############################################
# VARIABLES - EDIT THESE FOR YOUR ENVIRONMENT
##############################################
CLUSTER_NAME="dev-eks"     # <-- Your EKS cluster name
AWS_REGION="us-east-1"            # <-- AWS region of your cluster
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
IAM_POLICY_NAME="AWSLoadBalancerControllerIAMPolicy"
IAM_ROLE_NAME="AmazonEKSLoadBalancerControllerRole"
SERVICE_ACCOUNT_NAMESPACE="kube-system"
SERVICE_ACCOUNT_NAME="aws-load-balancer-controller"
##############################################

echo ">>> Creating IAM policy for ALB controller..."
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name $IAM_POLICY_NAME \
  --policy-document file://iam-policy.json || echo "Policy may already exist"

echo ">>> Creating IAM role for ALB controller with OIDC trust..."
eksctl utils associate-iam-oidc-provider \
  --region $AWS_REGION \
  --cluster $CLUSTER_NAME \
  --approve

eksctl create iamserviceaccount \
  --cluster $CLUSTER_NAME \
  --region $AWS_REGION \
  --namespace $SERVICE_ACCOUNT_NAMESPACE \
  --name $SERVICE_ACCOUNT_NAME \
  --attach-policy-arn arn:aws:iam::$ACCOUNT_ID:policy/$IAM_POLICY_NAME \
  --override-existing-serviceaccounts \
  --approve

echo ">>> Adding Helm repo for ALB controller..."
helm repo add eks https://aws.github.io/eks-charts
helm repo update

echo ">>> Installing ALB controller via Helm..."
helm upgrade -i aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n $SERVICE_ACCOUNT_NAMESPACE \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=false \
  --set serviceAccount.name=$SERVICE_ACCOUNT_NAME \
  --set region=$AWS_REGION \
  --set vpcId=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
        --query "cluster.resourcesVpcConfig.vpcId" --output text)

echo ">>> ALB controller setup completed successfully!"
