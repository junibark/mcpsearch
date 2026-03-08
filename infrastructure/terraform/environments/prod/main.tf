# =============================================================================
# MCPSearch - Production Environment
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
    key            = "prod/terraform.tfstate"
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
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# Secondary region for disaster recovery
provider "aws" {
  alias  = "dr"
  region = "us-west-2"

  default_tags {
    tags = {
      Project     = "mcp-search"
      Environment = "prod"
      ManagedBy   = "terraform"
      Purpose     = "disaster-recovery"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "Disaster recovery AWS region"
  type        = string
  default     = "us-west-2"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "mcpsearch.com"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (must be in us-east-1 for CloudFront)"
  type        = string
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

# =============================================================================
# Local Values
# =============================================================================

locals {
  environment = "prod"
  project     = "mcp-search"

  # Production settings - high availability
  vpc_cidr           = "10.2.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # Production-grade instances
  api_cpu    = 1024
  api_memory = 2048
  web_cpu    = 1024
  web_memory = 2048
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
  single_nat_gateway     = false  # HA NAT gateways in production
  enable_vpc_endpoints   = true
  enable_flow_logs       = true
}

# =============================================================================
# DynamoDB Module
# =============================================================================

module "dynamodb" {
  source = "../../modules/dynamodb"

  project     = local.project
  environment = local.environment

  # Provisioned capacity with auto-scaling for production
  billing_mode   = "PROVISIONED"
  read_capacity  = 50
  write_capacity = 25

  # Auto-scaling configuration
  enable_autoscaling = true
  autoscaling_min_read_capacity  = 50
  autoscaling_max_read_capacity  = 1000
  autoscaling_min_write_capacity = 25
  autoscaling_max_write_capacity = 500

  # Production data protection
  point_in_time_recovery = true
  deletion_protection    = true

  # Global tables for DR
  enable_global_table = true
  replica_regions     = [var.dr_region]
}

# =============================================================================
# S3 Module
# =============================================================================

module "s3" {
  source = "../../modules/s3"

  project     = local.project
  environment = local.environment

  log_retention_days = 90
  enable_versioning  = true

  # Cross-region replication for DR
  enable_replication   = true
  replication_region   = var.dr_region
}

# =============================================================================
# Cognito Module
# =============================================================================

module "cognito" {
  source = "../../modules/cognito"

  project     = local.project
  environment = local.environment
  domain_name = var.domain_name

  # Strong password policy for production
  password_minimum_length    = 12
  require_lowercase          = true
  require_uppercase          = true
  require_numbers            = true
  require_symbols            = true

  # MFA configuration
  mfa_configuration = "OPTIONAL"

  # Advanced security
  enable_advanced_security = true

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "https://www.${var.domain_name}/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain_name}",
    "https://www.${var.domain_name}",
  ]
}

# =============================================================================
# ElastiCache Module (Redis Cluster)
# =============================================================================

module "elasticache" {
  source = "../../modules/elasticache"

  project     = local.project
  environment = local.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Production cluster configuration
  node_type                  = "cache.r6g.large"
  num_cache_nodes            = 3
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Maintenance
  snapshot_retention_limit = 7
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"
}

# =============================================================================
# OpenSearch Module
# =============================================================================

module "opensearch" {
  source = "../../modules/opensearch"

  project     = local.project
  environment = local.environment

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Production cluster
  instance_type  = "r6g.large.search"
  instance_count = 3

  # Storage
  ebs_volume_size = 100
  ebs_volume_type = "gp3"

  # Multi-AZ
  zone_awareness_enabled = true

  # Security
  encrypt_at_rest    = true
  node_to_node_encryption = true

  # Fine-grained access control
  enable_fine_grained_access = true
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

  # Production capacity with auto-scaling
  api_desired_count = 3
  api_min_count     = 3
  api_max_count     = 20
  api_cpu           = local.api_cpu
  api_memory        = local.api_memory

  web_desired_count = 3
  web_min_count     = 3
  web_max_count     = 20
  web_cpu           = local.web_cpu
  web_memory        = local.web_memory

  worker_desired_count = 2
  worker_min_count     = 2
  worker_max_count     = 10

  # Auto-scaling configuration
  enable_autoscaling          = true
  cpu_target_utilization      = 70
  memory_target_utilization   = 80

  # Health check configuration
  health_check_grace_period = 60

  # Deployment configuration
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  # Environment variables
  api_environment = {
    NODE_ENV            = "production"
    LOG_LEVEL           = "info"
    DYNAMODB_TABLE      = module.dynamodb.table_name
    PACKAGES_BUCKET     = module.s3.packages_bucket_name
    COGNITO_USER_POOL   = module.cognito.user_pool_id
    COGNITO_CLIENT_ID   = module.cognito.web_client_id
    REDIS_URL           = module.elasticache.primary_endpoint
    OPENSEARCH_ENDPOINT = module.opensearch.endpoint
  }

  web_environment = {
    NODE_ENV                       = "production"
    NEXT_PUBLIC_API_URL            = "https://api.${var.domain_name}"
    NEXT_PUBLIC_COGNITO_USER_POOL  = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_CLIENT_ID  = module.cognito.web_client_id
  }

  api_secrets = {
    OPENSEARCH_PASSWORD = module.opensearch.master_password_secret_arn
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
    packages = {
      domain_name = module.s3.packages_bucket_domain_name
      origin_id   = "s3-packages"
    }
  }

  # Production WAF with rate limiting
  enable_waf = true
  waf_rules = {
    rate_limit_rule = {
      priority = 1
      action   = "block"
      rate_limit = 2000  # Requests per 5 minutes per IP
    }
    aws_managed_rules = {
      priority = 2
      managed_rule_group_name = "AWSManagedRulesCommonRuleSet"
    }
    known_bad_inputs = {
      priority = 3
      managed_rule_group_name = "AWSManagedRulesKnownBadInputsRuleSet"
    }
  }

  # Cache optimization
  default_ttl = 86400
  max_ttl     = 31536000

  # Logging
  enable_logging = true
  log_bucket     = module.s3.logs_bucket_name
}

# =============================================================================
# Monitoring & Alerting
# =============================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  project     = local.project
  environment = local.environment

  alert_email = var.alert_email

  # Resources to monitor
  ecs_cluster_name       = module.ecs.cluster_name
  dynamodb_table_name    = module.dynamodb.table_name
  elasticache_cluster_id = module.elasticache.cluster_id
  opensearch_domain_name = module.opensearch.domain_name

  # CloudWatch dashboard
  create_dashboard = true

  # Alarms
  alarms = {
    api_high_cpu = {
      metric_name         = "CPUUtilization"
      namespace           = "AWS/ECS"
      threshold           = 80
      evaluation_periods  = 3
      period              = 300
    }
    api_high_memory = {
      metric_name         = "MemoryUtilization"
      namespace           = "AWS/ECS"
      threshold           = 85
      evaluation_periods  = 3
      period              = 300
    }
    dynamodb_throttled = {
      metric_name         = "ThrottledRequests"
      namespace           = "AWS/DynamoDB"
      threshold           = 10
      evaluation_periods  = 2
      period              = 300
    }
    error_rate_high = {
      metric_name         = "5XXError"
      namespace           = "AWS/ApplicationELB"
      threshold           = 5
      evaluation_periods  = 3
      period              = 300
    }
  }
}

# =============================================================================
# WAF Web ACL
# =============================================================================

resource "aws_wafv2_web_acl" "main" {
  name        = "${local.project}-${local.environment}-web-acl"
  description = "WAF rules for MCPSearch production"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate limiting
  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "aws-managed-common"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "aws-managed-bad-inputs"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "aws-managed-sql"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.project}-${local.environment}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${local.project}-${local.environment}-web-acl"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = module.dynamodb.table_arn
}

output "packages_bucket" {
  description = "S3 packages bucket name"
  value       = module.s3.packages_bucket_name
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_web_client_id" {
  description = "Cognito web client ID"
  value       = module.cognito.web_client_id
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
  sensitive   = true
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint"
  value       = module.opensearch.endpoint
  sensitive   = true
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = module.cloudfront.domain_name
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "api_service_name" {
  description = "API ECS service name"
  value       = module.ecs.api_service_name
}

output "web_service_name" {
  description = "Web ECS service name"
  value       = module.ecs.web_service_name
}
