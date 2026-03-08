#!/bin/bash
set -e

# MCPSearch API - AWS App Runner Deployment Script
# This script deploys the API to AWS App Runner for a quick MVP deployment

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
APP_NAME="mcpsearch-api"
ECR_REPO_NAME="mcpsearch/api"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}MCPSearch API - AWS App Runner Deployment${NC}"
echo "==========================================="

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi

    if [ -z "$AWS_ACCOUNT_ID" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            echo -e "${RED}Error: Could not get AWS Account ID. Please configure AWS credentials.${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}Prerequisites OK${NC}"
    echo "  AWS Region: $AWS_REGION"
    echo "  AWS Account: $AWS_ACCOUNT_ID"
}

# Create ECR repository if it doesn't exist
create_ecr_repo() {
    echo -e "\n${YELLOW}Creating ECR repository...${NC}"

    aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" &> /dev/null || \
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true

    echo -e "${GREEN}ECR repository ready: $ECR_REPO_NAME${NC}"
}

# Build and push Docker image
build_and_push() {
    echo -e "\n${YELLOW}Building Docker image...${NC}"

    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

    # Navigate to project root
    cd "$(dirname "$0")/.."

    # Build the image
    docker build -t "$APP_NAME:$IMAGE_TAG" -f infrastructure/docker/api.Dockerfile .

    # Tag for ECR
    docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_URI:$IMAGE_TAG"

    echo -e "\n${YELLOW}Pushing to ECR...${NC}"

    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

    # Push image
    docker push "$ECR_URI:$IMAGE_TAG"

    echo -e "${GREEN}Image pushed: $ECR_URI:$IMAGE_TAG${NC}"
}

# Create App Runner service
create_app_runner() {
    echo -e "\n${YELLOW}Creating App Runner service...${NC}"

    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"

    # Check if service already exists
    SERVICE_ARN=$(aws apprunner list-services --region "$AWS_REGION" \
        --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" \
        --output text 2>/dev/null)

    if [ -n "$SERVICE_ARN" ] && [ "$SERVICE_ARN" != "None" ]; then
        echo "Service exists, updating..."

        aws apprunner update-service \
            --service-arn "$SERVICE_ARN" \
            --source-configuration "{
                \"ImageRepository\": {
                    \"ImageIdentifier\": \"$ECR_URI\",
                    \"ImageRepositoryType\": \"ECR\",
                    \"ImageConfiguration\": {
                        \"Port\": \"8080\",
                        \"RuntimeEnvironmentVariables\": {
                            \"NODE_ENV\": \"production\",
                            \"USE_SEED_DATA\": \"true\",
                            \"LOG_LEVEL\": \"info\"
                        }
                    }
                },
                \"AutoDeploymentsEnabled\": false,
                \"AuthenticationConfiguration\": {
                    \"AccessRoleArn\": \"arn:aws:iam::$AWS_ACCOUNT_ID:role/AppRunnerECRAccessRole\"
                }
            }" \
            --region "$AWS_REGION"
    else
        echo "Creating new service..."

        # First, create IAM role for App Runner to access ECR
        create_apprunner_role

        aws apprunner create-service \
            --service-name "$APP_NAME" \
            --source-configuration "{
                \"ImageRepository\": {
                    \"ImageIdentifier\": \"$ECR_URI\",
                    \"ImageRepositoryType\": \"ECR\",
                    \"ImageConfiguration\": {
                        \"Port\": \"8080\",
                        \"RuntimeEnvironmentVariables\": {
                            \"NODE_ENV\": \"production\",
                            \"USE_SEED_DATA\": \"true\",
                            \"LOG_LEVEL\": \"info\"
                        }
                    }
                },
                \"AutoDeploymentsEnabled\": false,
                \"AuthenticationConfiguration\": {
                    \"AccessRoleArn\": \"arn:aws:iam::$AWS_ACCOUNT_ID:role/AppRunnerECRAccessRole\"
                }
            }" \
            --instance-configuration "{
                \"Cpu\": \"0.25 vCPU\",
                \"Memory\": \"0.5 GB\"
            }" \
            --health-check-configuration "{
                \"Protocol\": \"HTTP\",
                \"Path\": \"/health\",
                \"Interval\": 10,
                \"Timeout\": 5,
                \"HealthyThreshold\": 1,
                \"UnhealthyThreshold\": 5
            }" \
            --region "$AWS_REGION"
    fi

    echo -e "${GREEN}App Runner service created/updated${NC}"
}

# Create IAM role for App Runner ECR access
create_apprunner_role() {
    echo -e "\n${YELLOW}Creating App Runner IAM role...${NC}"

    ROLE_NAME="AppRunnerECRAccessRole"

    # Check if role exists
    if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
        echo "Role already exists"
        return
    fi

    # Create trust policy
    cat > /tmp/trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "build.apprunner.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json

    # Attach ECR policy
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"

    echo -e "${GREEN}IAM role created${NC}"

    # Wait for role to propagate
    sleep 10
}

# Get service URL
get_service_url() {
    echo -e "\n${YELLOW}Getting service URL...${NC}"

    # Wait for service to be running
    echo "Waiting for service to be ready (this may take a few minutes)..."

    for i in {1..30}; do
        STATUS=$(aws apprunner describe-service \
            --service-arn "$(aws apprunner list-services --region "$AWS_REGION" \
                --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" \
                --output text)" \
            --region "$AWS_REGION" \
            --query "Service.Status" \
            --output text 2>/dev/null)

        if [ "$STATUS" = "RUNNING" ]; then
            break
        fi

        echo "  Status: $STATUS (attempt $i/30)"
        sleep 10
    done

    SERVICE_URL=$(aws apprunner describe-service \
        --service-arn "$(aws apprunner list-services --region "$AWS_REGION" \
            --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" \
            --output text)" \
        --region "$AWS_REGION" \
        --query "Service.ServiceUrl" \
        --output text)

    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    echo -e "API URL: ${GREEN}https://$SERVICE_URL${NC}"
    echo ""
    echo "Test the API:"
    echo "  curl https://$SERVICE_URL/health"
    echo "  curl https://$SERVICE_URL/v1/packages"
    echo ""
    echo "Update your CLI config:"
    echo "  mcp config set registry https://$SERVICE_URL"
    echo ""
}

# Main
main() {
    check_prerequisites
    create_ecr_repo
    build_and_push
    create_app_runner
    get_service_url
}

main "$@"
