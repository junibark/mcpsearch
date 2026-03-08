# =============================================================================
# CloudFront Distribution Module
# =============================================================================

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "origins" {
  type = map(object({
    domain_name = string
    origin_id   = string
  }))
}

variable "enable_waf" {
  type    = bool
  default = false
}

variable "waf_web_acl_arn" {
  type    = string
  default = ""
}

variable "default_ttl" {
  type    = number
  default = 86400
}

variable "max_ttl" {
  type    = number
  default = 31536000
}

variable "enable_logging" {
  type    = bool
  default = false
}

variable "log_bucket" {
  type    = string
  default = ""
}

# =============================================================================
# Locals
# =============================================================================

locals {
  name = "${var.project}-${var.environment}"
}

# =============================================================================
# CloudFront Distribution
# =============================================================================

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project} ${var.environment} distribution"
  default_root_object = ""
  price_class         = "PriceClass_100"  # US, Canada, Europe
  aliases             = [var.domain_name, "www.${var.domain_name}"]

  # Web origin (default)
  dynamic "origin" {
    for_each = { for k, v in var.origins : k => v if k == "web" }
    content {
      domain_name = origin.value.domain_name
      origin_id   = origin.value.origin_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # API origin
  dynamic "origin" {
    for_each = { for k, v in var.origins : k => v if k == "api" }
    content {
      domain_name = origin.value.domain_name
      origin_id   = origin.value.origin_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # S3 origins
  dynamic "origin" {
    for_each = { for k, v in var.origins : k => v if k == "assets" || k == "packages" }
    content {
      domain_name = origin.value.domain_name
      origin_id   = origin.value.origin_id

      s3_origin_config {
        origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
      }
    }
  }

  # Default cache behavior (web)
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "web-alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Accept", "Accept-Language", "Authorization"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # API cache behavior
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Accept", "Accept-Language", "Authorization", "Content-Type"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # V1 API cache behavior
  ordered_cache_behavior {
    path_pattern     = "/v1/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Accept", "Accept-Language", "Authorization", "Content-Type"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # Static assets cache behavior
  dynamic "ordered_cache_behavior" {
    for_each = contains(keys(var.origins), "assets") ? [1] : []
    content {
      path_pattern     = "/assets/*"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD"]
      target_origin_id = "s3-assets"

      forwarded_values {
        query_string = false
        cookies {
          forward = "none"
        }
      }

      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = var.default_ttl
      max_ttl                = var.max_ttl
      compress               = true
    }
  }

  # Next.js static files
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "web-alb"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # WAF
  web_acl_id = var.enable_waf && var.waf_web_acl_arn != "" ? var.waf_web_acl_arn : null

  # Logging
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      include_cookies = false
      bucket          = "${var.log_bucket}.s3.amazonaws.com"
      prefix          = "cloudfront/"
    }
  }

  tags = {
    Name = local.name
  }
}

# =============================================================================
# Origin Access Identity for S3
# =============================================================================

resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${var.project} ${var.environment}"
}

# =============================================================================
# Outputs
# =============================================================================

output "distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.main.arn
}

output "domain_name" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "hosted_zone_id" {
  value = aws_cloudfront_distribution.main.hosted_zone_id
}

output "origin_access_identity_path" {
  value = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
}

output "origin_access_identity_iam_arn" {
  value = aws_cloudfront_origin_access_identity.main.iam_arn
}
