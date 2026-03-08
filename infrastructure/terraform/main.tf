# MCPSearch Infrastructure
# Main Terraform configuration

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure for production
  # backend "s3" {
  #   bucket         = "mcpsearch-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "mcpsearch-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "mcpsearch"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Secondary provider for CloudFront (must be us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ============================================
# Variables
# ============================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "mcpsearch.com"
}

# ============================================
# Modules
# ============================================

module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  aws_region  = var.aws_region
}

module "dynamodb" {
  source = "./modules/dynamodb"

  environment = var.environment
  table_name  = "mcp-search-${var.environment}"
}

module "s3" {
  source = "./modules/s3"

  environment = var.environment
}

module "cognito" {
  source = "./modules/cognito"

  environment = var.environment
  domain_name = var.domain_name
}

module "ecs" {
  source = "./modules/ecs"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids
}

# ============================================
# Outputs
# ============================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb.table_name
}

output "packages_bucket" {
  description = "S3 bucket for packages"
  value       = module.s3.packages_bucket_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito Client ID"
  value       = module.cognito.client_id
}

output "ecs_cluster_name" {
  description = "ECS Cluster name"
  value       = module.ecs.cluster_name
}
