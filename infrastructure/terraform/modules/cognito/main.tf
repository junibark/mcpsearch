# Cognito Module
# Creates User Pool for authentication

variable "environment" {
  type = string
}

variable "domain_name" {
  type = string
}

# ============================================
# User Pool
# ============================================

resource "aws_cognito_user_pool" "main" {
  name = "mcp-search-${var.environment}"

  # Username configuration
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # MFA configuration
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Schema attributes
  schema {
    name                     = "username"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = false
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 3
      max_length = 39
    }
  }

  # Verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "MCPSearch - Verify your email"
    email_message        = "Your verification code is {####}"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = var.environment == "prod" ? "ENFORCED" : "OFF"
  }

  tags = {
    Name = "mcp-search-${var.environment}"
  }
}

# ============================================
# User Pool Domain
# ============================================

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "mcpsearch-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# ============================================
# App Client (Web)
# ============================================

resource "aws_cognito_user_pool_client" "web" {
  name         = "mcp-search-web-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  supported_identity_providers = ["COGNITO"]

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "http://localhost:3000/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain_name}",
    "http://localhost:3000",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

# ============================================
# App Client (CLI)
# ============================================

resource "aws_cognito_user_pool_client" "cli" {
  name         = "mcp-search-cli-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  supported_identity_providers = ["COGNITO"]

  # Device code flow for CLI
  callback_urls = [
    "http://localhost:9999/callback",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  access_token_validity  = 24 # hours (longer for CLI)
  id_token_validity      = 24 # hours
  refresh_token_validity = 90 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

# ============================================
# Identity Providers (optional - for social login)
# ============================================

# GitHub OAuth (uncomment and configure)
# resource "aws_cognito_identity_provider" "github" {
#   user_pool_id  = aws_cognito_user_pool.main.id
#   provider_name = "GitHub"
#   provider_type = "OIDC"
#
#   provider_details = {
#     client_id                     = var.github_client_id
#     client_secret                 = var.github_client_secret
#     authorize_scopes              = "openid email profile"
#     oidc_issuer                   = "https://github.com"
#     attributes_request_method     = "GET"
#   }
#
#   attribute_mapping = {
#     email    = "email"
#     username = "sub"
#   }
# }

# ============================================
# Outputs
# ============================================

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cli_client_id" {
  value = aws_cognito_user_pool_client.cli.id
}

output "domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "endpoint" {
  value = aws_cognito_user_pool.main.endpoint
}
