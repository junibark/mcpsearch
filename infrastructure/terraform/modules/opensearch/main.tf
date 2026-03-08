# =============================================================================
# OpenSearch Module
# =============================================================================

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type    = string
  default = "t3.small.search"
}

variable "instance_count" {
  type    = number
  default = 1
}

variable "ebs_volume_size" {
  type    = number
  default = 20
}

variable "ebs_volume_type" {
  type    = string
  default = "gp3"
}

variable "zone_awareness_enabled" {
  type    = bool
  default = false
}

variable "encrypt_at_rest" {
  type    = bool
  default = true
}

variable "node_to_node_encryption" {
  type    = bool
  default = true
}

variable "enable_fine_grained_access" {
  type    = bool
  default = false
}

# =============================================================================
# Locals
# =============================================================================

locals {
  name        = "${var.project}-${var.environment}"
  domain_name = replace("${var.project}-${var.environment}", "_", "-")
}

# =============================================================================
# Security Group
# =============================================================================

resource "aws_security_group" "opensearch" {
  name        = "${local.name}-opensearch"
  description = "Security group for OpenSearch domain"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-opensearch-sg"
  }
}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# =============================================================================
# IAM Service-Linked Role
# =============================================================================

resource "aws_iam_service_linked_role" "opensearch" {
  aws_service_name = "opensearchservice.amazonaws.com"
  description      = "Service-linked role for OpenSearch"

  # This role may already exist, so ignore errors
  lifecycle {
    ignore_changes = [aws_service_name]
  }
}

# =============================================================================
# OpenSearch Domain
# =============================================================================

resource "aws_opensearch_domain" "main" {
  domain_name    = local.domain_name
  engine_version = "OpenSearch_2.11"

  cluster_config {
    instance_type          = var.instance_type
    instance_count         = var.instance_count
    zone_awareness_enabled = var.zone_awareness_enabled

    dynamic "zone_awareness_config" {
      for_each = var.zone_awareness_enabled ? [1] : []
      content {
        availability_zone_count = min(var.instance_count, 3)
      }
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_size = var.ebs_volume_size
    volume_type = var.ebs_volume_type
  }

  vpc_options {
    subnet_ids         = var.zone_awareness_enabled ? slice(var.private_subnet_ids, 0, min(var.instance_count, 3)) : [var.private_subnet_ids[0]]
    security_group_ids = [aws_security_group.opensearch.id]
  }

  encrypt_at_rest {
    enabled = var.encrypt_at_rest
  }

  node_to_node_encryption {
    enabled = var.node_to_node_encryption
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  dynamic "advanced_security_options" {
    for_each = var.enable_fine_grained_access ? [1] : []
    content {
      enabled                        = true
      internal_user_database_enabled = true
      master_user_options {
        master_user_name     = "admin"
        master_user_password = random_password.opensearch_master.result
      }
    }
  }

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "es:*"
        Resource = "arn:aws:es:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:domain/${local.domain_name}/*"
        Condition = {
          IpAddress = {
            "aws:SourceIp" = [data.aws_vpc.selected.cidr_block]
          }
        }
      }
    ]
  })

  tags = {
    Name = local.domain_name
  }

  depends_on = [aws_iam_service_linked_role.opensearch]
}

# =============================================================================
# Master Password (for fine-grained access)
# =============================================================================

resource "random_password" "opensearch_master" {
  length  = 32
  special = true
  # OpenSearch has specific requirements for special characters
  override_special = "!#$%&*()-_=+[]{}|"
}

resource "aws_secretsmanager_secret" "opensearch_master_password" {
  name        = "${local.name}/opensearch/master-password"
  description = "OpenSearch master password for ${var.project} ${var.environment}"

  tags = {
    Name = "${local.name}-opensearch-master-password"
  }
}

resource "aws_secretsmanager_secret_version" "opensearch_master_password" {
  secret_id = aws_secretsmanager_secret.opensearch_master_password.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.opensearch_master.result
  })
}

# =============================================================================
# Outputs
# =============================================================================

output "domain_name" {
  value = aws_opensearch_domain.main.domain_name
}

output "domain_id" {
  value = aws_opensearch_domain.main.domain_id
}

output "endpoint" {
  value = aws_opensearch_domain.main.endpoint
}

output "dashboard_endpoint" {
  value = aws_opensearch_domain.main.dashboard_endpoint
}

output "arn" {
  value = aws_opensearch_domain.main.arn
}

output "security_group_id" {
  value = aws_security_group.opensearch.id
}

output "master_password_secret_arn" {
  value = aws_secretsmanager_secret.opensearch_master_password.arn
}
