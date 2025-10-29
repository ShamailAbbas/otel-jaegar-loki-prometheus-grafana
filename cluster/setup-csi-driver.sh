#!/bin/bash
# -----------------------------
# VARIABLES - CHANGE IF NEEDED
# -----------------------------
CLUSTER_NAME="dev-eks"
REGION="us-east-1"
SERVICE_ACCOUNT_NAME="ebs-csi-addon-sa"
NAMESPACE="kube-system"

# -----------------------------
# STEP 1: CREATE IRSA ROLE FOR EBS CSI ADDON
# -----------------------------
echo "Creating IAM role for EBS CSI Addon using IRSA..."
eksctl create iamserviceaccount \
  --cluster $CLUSTER_NAME \
  --namespace kube-system \
  --name ebs-csi-controller-sa \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve \
  --region $REGION



# -----------------------------
# STEP 2: CREATE EKS MANAGED ADDON
# -----------------------------
echo "Installing EKS-managed EBS CSI addon..."

helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
helm repo update

helm install aws-ebs-csi-driver aws-ebs-csi-driver/aws-ebs-csi-driver \
  --namespace kube-system \
  --set controller.serviceAccount.create=false \
  --set controller.serviceAccount.name=ebs-csi-controller-sa




echo "✅ EKS-managed EBS CSI addon setup complete!"