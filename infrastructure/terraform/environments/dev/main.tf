# =============================================================================
# MCPSearch - Development Environment
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "mcp-search-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "mcp-search-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "mcp-search"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "dev.mcpsearch.com"
}

# =============================================================================
# Local Values
# =============================================================================

locals {
  environment = "dev"
  project     = "mcp-search"

  # Dev-specific settings
  vpc_cidr             = "10.0.0.0/16"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  ecs_desired_count    = 1
  dynamodb_billing_mode = "PAY_PER_REQUEST"

  # Smaller instances for dev
  api_cpu    = 256
  api_memory = 512
  web_cpu    = 256
  web_memory = 512
}

# =============================================================================
# VPC Module
# =============================================================================

module "vpc" {
  source = "../../modules/vpc"

  project            = local.project
  environment        = local.environment
  vpc_cidr           = local.vpc_cidr
  availability_zones = local.availability_zones

  # Dev can skip NAT for cost savings (use VPC endpoints instead)
  enable_nat_gateway = false
}

# =============================================================================
# DynamoDB Module
# =============================================================================

module "dynamodb" {
  source = "../../modules/dynamodb"

  project       = local.project
  environment   = local.environment
  billing_mode  = local.dynamodb_billing_mode

  # No point-in-time recovery for dev
  point_in_time_recovery = false
}

# =============================================================================
# S3 Module
# =============================================================================

module "s3" {
  source = "../../modules/s3"

  project     = local.project
  environment = local.environment

  # Shorter retention for dev
  log_retention_days = 7
}

# =============================================================================
# Cognito Module
# =============================================================================

module "cognito" {
  source = "../../modules/cognito"

  project     = local.project
  environment = local.environment
  domain_name = var.domain_name

  # Relaxed password policy for dev
  password_minimum_length = 8

  callback_urls = [
    "http://localhost:3000/auth/callback",
    "https://${var.domain_name}/auth/callback",
  ]

  logout_urls = [
    "http://localhost:3000",
    "https://${var.domain_name}",
  ]
}

# =============================================================================
# ECS Module (Optional for dev - can use local docker-compose)
# =============================================================================

module "ecs" {
  source = "../../modules/ecs"

  project     = local.project
  environment = local.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  # Minimal setup for dev
  api_desired_count = 1
  api_cpu           = local.api_cpu
  api_memory        = local.api_memory

  web_desired_count = 1
  web_cpu           = local.web_cpu
  web_memory        = local.web_memory

  # Environment variables
  api_environment = {
    NODE_ENV          = "development"
    LOG_LEVEL         = "debug"
    DYNAMODB_TABLE    = module.dynamodb.table_name
    PACKAGES_BUCKET   = module.s3.packages_bucket_name
    COGNITO_USER_POOL = module.cognito.user_pool_id
    COGNITO_CLIENT_ID = module.cognito.web_client_id
  }

  web_environment = {
    NODE_ENV                       = "development"
    NEXT_PUBLIC_API_URL            = "https://api.${var.domain_name}"
    NEXT_PUBLIC_COGNITO_USER_POOL  = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_CLIENT_ID  = module.cognito.web_client_id
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "dynamodb_table_name" {
  value = module.dynamodb.table_name
}

output "packages_bucket" {
  value = module.s3.packages_bucket_name
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "api_url" {
  value = module.ecs.api_url
}

output "web_url" {
  value = module.ecs.web_url
}
