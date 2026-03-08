# =============================================================================
# MCPSearch - Staging Environment
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
    key            = "staging/terraform.tfstate"
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
      Environment = "staging"
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
  default     = "staging.mcpsearch.com"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

# =============================================================================
# Local Values
# =============================================================================

locals {
  environment = "staging"
  project     = "mcp-search"

  # Staging settings - closer to production but smaller scale
  vpc_cidr             = "10.1.0.0/16"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  dynamodb_billing_mode = "PAY_PER_REQUEST"

  # Medium instances for staging
  api_cpu    = 512
  api_memory = 1024
  web_cpu    = 512
  web_memory = 1024
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

  enable_nat_gateway     = true
  single_nat_gateway     = true  # Cost savings for staging
  enable_vpc_endpoints   = true
}

# =============================================================================
# DynamoDB Module
# =============================================================================

module "dynamodb" {
  source = "../../modules/dynamodb"

  project       = local.project
  environment   = local.environment
  billing_mode  = local.dynamodb_billing_mode

  point_in_time_recovery = true
}

# =============================================================================
# S3 Module
# =============================================================================

module "s3" {
  source = "../../modules/s3"

  project     = local.project
  environment = local.environment

  log_retention_days     = 30
  enable_versioning      = true
  enable_replication     = false  # No replication for staging
}

# =============================================================================
# Cognito Module
# =============================================================================

module "cognito" {
  source = "../../modules/cognito"

  project     = local.project
  environment = local.environment
  domain_name = var.domain_name

  password_minimum_length = 12

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain_name}",
  ]
}

# =============================================================================
# ElastiCache Module (Redis)
# =============================================================================

module "elasticache" {
  source = "../../modules/elasticache"

  project     = local.project
  environment = local.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Small instance for staging
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
}

# =============================================================================
# ECS Module
# =============================================================================

module "ecs" {
  source = "../../modules/ecs"

  project     = local.project
  environment = local.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  certificate_arn = var.certificate_arn

  # Staging capacity
  api_desired_count = 2
  api_cpu           = local.api_cpu
  api_memory        = local.api_memory

  web_desired_count = 2
  web_cpu           = local.web_cpu
  web_memory        = local.web_memory

  worker_desired_count = 1

  # Environment variables
  api_environment = {
    NODE_ENV          = "staging"
    LOG_LEVEL         = "info"
    DYNAMODB_TABLE    = module.dynamodb.table_name
    PACKAGES_BUCKET   = module.s3.packages_bucket_name
    COGNITO_USER_POOL = module.cognito.user_pool_id
    COGNITO_CLIENT_ID = module.cognito.web_client_id
    REDIS_URL         = module.elasticache.primary_endpoint
  }

  web_environment = {
    NODE_ENV                       = "staging"
    NEXT_PUBLIC_API_URL            = "https://api.${var.domain_name}"
    NEXT_PUBLIC_COGNITO_USER_POOL  = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_CLIENT_ID  = module.cognito.web_client_id
  }
}

# =============================================================================
# CloudFront Distribution
# =============================================================================

module "cloudfront" {
  source = "../../modules/cloudfront"

  project     = local.project
  environment = local.environment

  domain_name     = var.domain_name
  certificate_arn = var.certificate_arn

  origins = {
    web = {
      domain_name = module.ecs.web_alb_dns_name
      origin_id   = "web-alb"
    }
    api = {
      domain_name = module.ecs.api_alb_dns_name
      origin_id   = "api-alb"
    }
    assets = {
      domain_name = module.s3.assets_bucket_domain_name
      origin_id   = "s3-assets"
    }
  }

  # WAF for staging
  enable_waf = true
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

output "redis_endpoint" {
  value     = module.elasticache.primary_endpoint
  sensitive = true
}

output "cloudfront_distribution_id" {
  value = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  value = module.cloudfront.domain_name
}
