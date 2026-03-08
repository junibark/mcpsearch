# DynamoDB Module
# Creates the main table with GSIs

variable "environment" {
  type = string
}

variable "table_name" {
  type = string
}

# ============================================
# Main Table (Single Table Design)
# ============================================

resource "aws_dynamodb_table" "main" {
  name         = var.table_name
  billing_mode = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  # Provisioned capacity (only for prod)
  dynamic "read_capacity" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      read_capacity  = 25
      write_capacity = 10
    }
  }

  # Primary key
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI attributes
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  attribute {
    name = "GSI3PK"
    type = "S"
  }

  attribute {
    name = "GSI3SK"
    type = "S"
  }

  # GSI1: Category + Downloads (for browsing)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"

    dynamic "read_capacity" {
      for_each = var.environment == "prod" ? [1] : []
      content {
        read_capacity  = 10
        write_capacity = 5
      }
    }
  }

  # GSI2: Publisher + Created (for user packages)
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"

    dynamic "read_capacity" {
      for_each = var.environment == "prod" ? [1] : []
      content {
        read_capacity  = 10
        write_capacity = 5
      }
    }
  }

  # GSI3: Status + Updated (for admin queries)
  global_secondary_index {
    name            = "GSI3"
    hash_key        = "GSI3PK"
    range_key       = "GSI3SK"
    projection_type = "ALL"

    dynamic "read_capacity" {
      for_each = var.environment == "prod" ? [1] : []
      content {
        read_capacity  = 5
        write_capacity = 2
      }
    }
  }

  # TTL for ephemeral data (hourly downloads, etc.)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Encryption
  server_side_encryption {
    enabled = true
  }

  # Stream for OpenSearch sync
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = {
    Name = var.table_name
  }

  lifecycle {
    prevent_destroy = false # Set to true for production
  }
}

# ============================================
# Auto Scaling (Production only)
# ============================================

resource "aws_appautoscaling_target" "read" {
  count = var.environment == "prod" ? 1 : 0

  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/${aws_dynamodb_table.main.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "read" {
  count = var.environment == "prod" ? 1 : 0

  name               = "DynamoDBReadAutoScaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.read[0].resource_id
  scalable_dimension = aws_appautoscaling_target.read[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.read[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_target" "write" {
  count = var.environment == "prod" ? 1 : 0

  max_capacity       = 50
  min_capacity       = 5
  resource_id        = "table/${aws_dynamodb_table.main.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "write" {
  count = var.environment == "prod" ? 1 : 0

  name               = "DynamoDBWriteAutoScaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.write[0].resource_id
  scalable_dimension = aws_appautoscaling_target.write[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.write[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = 70.0
  }
}

# ============================================
# Outputs
# ============================================

output "table_name" {
  value = aws_dynamodb_table.main.name
}

output "table_arn" {
  value = aws_dynamodb_table.main.arn
}

output "stream_arn" {
  value = aws_dynamodb_table.main.stream_arn
}
