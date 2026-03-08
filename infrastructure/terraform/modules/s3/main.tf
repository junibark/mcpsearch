# S3 Module
# Creates buckets for packages and assets

variable "environment" {
  type = string
}

# ============================================
# Packages Bucket
# ============================================

resource "aws_s3_bucket" "packages" {
  bucket = "mcp-search-packages-${var.environment}"

  tags = {
    Name = "mcp-search-packages-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "packages" {
  bucket = aws_s3_bucket.packages.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "packages" {
  bucket = aws_s3_bucket.packages.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "packages" {
  bucket = aws_s3_bucket.packages.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "packages" {
  bucket = aws_s3_bucket.packages.id

  rule {
    id     = "old-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# ============================================
# Assets Bucket (avatars, logos, etc.)
# ============================================

resource "aws_s3_bucket" "assets" {
  bucket = "mcp-search-assets-${var.environment}"

  tags = {
    Name = "mcp-search-assets-${var.environment}"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ============================================
# CLI Releases Bucket
# ============================================

resource "aws_s3_bucket" "cli_releases" {
  bucket = "mcp-search-cli-releases-${var.environment}"

  tags = {
    Name = "mcp-search-cli-releases-${var.environment}"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cli_releases" {
  bucket = aws_s3_bucket.cli_releases.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cli_releases" {
  bucket = aws_s3_bucket.cli_releases.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================
# Outputs
# ============================================

output "packages_bucket_name" {
  value = aws_s3_bucket.packages.id
}

output "packages_bucket_arn" {
  value = aws_s3_bucket.packages.arn
}

output "assets_bucket_name" {
  value = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}

output "cli_releases_bucket_name" {
  value = aws_s3_bucket.cli_releases.id
}
