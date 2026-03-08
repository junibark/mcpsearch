# =============================================================================
# Monitoring Module (CloudWatch)
# =============================================================================

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "alert_email" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "elasticache_cluster_id" {
  type    = string
  default = ""
}

variable "opensearch_domain_name" {
  type    = string
  default = ""
}

variable "create_dashboard" {
  type    = bool
  default = true
}

variable "alarms" {
  type = map(object({
    metric_name        = string
    namespace          = string
    threshold          = number
    evaluation_periods = number
    period             = number
  }))
  default = {}
}

# =============================================================================
# Locals
# =============================================================================

locals {
  name = "${var.project}-${var.environment}"
}

# =============================================================================
# SNS Topic for Alerts
# =============================================================================

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"

  tags = {
    Name = "${local.name}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# =============================================================================
# CloudWatch Log Groups
# =============================================================================

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}/api"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Name = "${local.name}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name}/web"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Name = "${local.name}-web-logs"
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}/worker"
  retention_in_days = var.environment == "prod" ? 90 : 30

  tags = {
    Name = "${local.name}-worker-logs"
  }
}

# =============================================================================
# CloudWatch Alarms
# =============================================================================

# API CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${local.name}-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "API service CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = "${local.name}-api"
  }

  tags = {
    Name = "${local.name}-api-cpu-alarm"
  }
}

# API Memory Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "api_memory_high" {
  alarm_name          = "${local.name}-api-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "API service memory utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = "${local.name}-api"
  }

  tags = {
    Name = "${local.name}-api-memory-alarm"
  }
}

# DynamoDB Throttled Requests Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttled" {
  alarm_name          = "${local.name}-dynamodb-throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "DynamoDB is experiencing throttled requests"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TableName = var.dynamodb_table_name
  }

  tags = {
    Name = "${local.name}-dynamodb-throttle-alarm"
  }
}

# DynamoDB Read Capacity Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_read_capacity" {
  alarm_name          = "${local.name}-dynamodb-read-capacity"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ConsumedReadCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "DynamoDB read capacity consumption is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TableName = var.dynamodb_table_name
  }

  tags = {
    Name = "${local.name}-dynamodb-read-alarm"
  }
}

# Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${local.name}-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "High error rate detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = "${local.name}-api"
  }

  treat_missing_data = "notBreaching"

  tags = {
    Name = "${local.name}-error-rate-alarm"
  }
}

# =============================================================================
# CloudWatch Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  count = var.create_dashboard ? 1 : 0

  dashboard_name = local.name

  dashboard_body = jsonencode({
    widgets = [
      # ECS Services Row
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# ECS Services"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "API CPU Utilization"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name}-api"]
          ]
          period = 300
          stat   = "Average"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "API Memory Utilization"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name}-api"]
          ]
          period = 300
          stat   = "Average"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Running Tasks"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ECS", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name}-api"],
            ["...", "${local.name}-web"],
            ["...", "${local.name}-worker"]
          ]
          period = 60
          stat   = "Average"
        }
      },
      # DynamoDB Row
      {
        type   = "text"
        x      = 0
        y      = 7
        width  = 24
        height = 1
        properties = {
          markdown = "# DynamoDB"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 8
        height = 6
        properties = {
          title  = "Read Capacity"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 8
        width  = 8
        height = 6
        properties = {
          title  = "Write Capacity"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.dynamodb_table_name]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 8
        width  = 8
        height = 6
        properties = {
          title  = "Throttled Requests"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", var.dynamodb_table_name]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      # Application Metrics Row
      {
        type   = "text"
        x      = 0
        y      = 14
        width  = 24
        height = 1
        properties = {
          markdown = "# Application Metrics"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 15
        width  = 12
        height = 6
        properties = {
          title  = "Request Count"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${local.name}-api"]
          ]
          period = 60
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 15
        width  = 12
        height = 6
        properties = {
          title  = "Response Time"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "${local.name}-api"]
          ]
          period = 60
          stat   = "Average"
        }
      }
    ]
  })
}

data "aws_region" "current" {}

# =============================================================================
# Outputs
# =============================================================================

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "api_log_group" {
  value = aws_cloudwatch_log_group.api.name
}

output "web_log_group" {
  value = aws_cloudwatch_log_group.web.name
}

output "worker_log_group" {
  value = aws_cloudwatch_log_group.worker.name
}

output "dashboard_name" {
  value = var.create_dashboard ? aws_cloudwatch_dashboard.main[0].dashboard_name : null
}
