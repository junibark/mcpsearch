import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { pino } from 'pino';
import * as fs from 'fs';
import { handlePackagePublish } from './handlers/package-publish.js';
import { handlePackageScan } from './handlers/package-scan.js';
import { handleAnalyticsAggregation } from './handlers/analytics-aggregation.js';
import { handleEmailNotification } from './handlers/email-notification.js';

// =============================================================================
// Configuration
// =============================================================================

const config = {
  queueUrl: process.env['SQS_QUEUE_URL'] || '',
  region: process.env['AWS_REGION'] || 'us-east-1',
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_MS'] || '5000', 10),
  maxMessages: parseInt(process.env['MAX_MESSAGES'] || '10', 10),
  visibilityTimeout: parseInt(process.env['VISIBILITY_TIMEOUT'] || '300', 10),
  heartbeatPath: '/tmp/worker-heartbeat',
};

// =============================================================================
// Logger
// =============================================================================

const isProduction = process.env['NODE_ENV'] === 'production';
const logger = pino(
  isProduction
    ? { level: process.env['LOG_LEVEL'] || 'info' }
    : {
        level: process.env['LOG_LEVEL'] || 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
);

// =============================================================================
// SQS Client
// =============================================================================

const sqsClient = new SQSClient({ region: config.region });

// =============================================================================
// Message Types
// =============================================================================

interface BaseMessage {
  type: string;
  timestamp: string;
  correlationId: string;
}

interface PackagePublishMessage extends BaseMessage {
  type: 'PACKAGE_PUBLISH';
  payload: {
    packageId: string;
    version: string;
    publisherId: string;
  };
}

interface PackageScanMessage extends BaseMessage {
  type: 'PACKAGE_SCAN';
  payload: {
    packageId: string;
    version: string;
    s3Key: string;
  };
}

interface AnalyticsAggregationMessage extends BaseMessage {
  type: 'ANALYTICS_AGGREGATION';
  payload: {
    period: 'hourly' | 'daily' | 'weekly';
    timestamp: string;
  };
}

interface EmailNotificationMessage extends BaseMessage {
  type: 'EMAIL_NOTIFICATION';
  payload: {
    templateId: string;
    recipient: string;
    data: Record<string, unknown>;
  };
}

type WorkerMessage =
  | PackagePublishMessage
  | PackageScanMessage
  | AnalyticsAggregationMessage
  | EmailNotificationMessage;

// =============================================================================
// Message Handler
// =============================================================================

async function handleMessage(message: WorkerMessage): Promise<void> {
  logger.info({ type: message.type, correlationId: message.correlationId }, 'Processing message');

  switch (message.type) {
    case 'PACKAGE_PUBLISH':
      await handlePackagePublish(message.payload, logger);
      break;
    case 'PACKAGE_SCAN':
      await handlePackageScan(message.payload, logger);
      break;
    case 'ANALYTICS_AGGREGATION':
      await handleAnalyticsAggregation(message.payload, logger);
      break;
    case 'EMAIL_NOTIFICATION':
      await handleEmailNotification(message.payload, logger);
      break;
    default:
      logger.warn({ type: (message as BaseMessage).type }, 'Unknown message type');
  }
}

// =============================================================================
// Poll Loop
// =============================================================================

async function pollMessages(): Promise<void> {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: config.queueUrl,
      MaxNumberOfMessages: config.maxMessages,
      VisibilityTimeout: config.visibilityTimeout,
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All'],
    });

    const response = await sqsClient.send(command);
    const messages = response.Messages || [];

    if (messages.length > 0) {
      logger.info({ count: messages.length }, 'Received messages');
    }

    for (const message of messages) {
      try {
        const body = JSON.parse(message.Body || '{}') as WorkerMessage;
        await handleMessage(body);

        // Delete message after successful processing
        await sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: config.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          })
        );

        logger.info(
          { messageId: message.MessageId, type: body.type },
          'Message processed successfully'
        );
      } catch (error) {
        logger.error(
          { error, messageId: message.MessageId },
          'Failed to process message'
        );
        // Message will return to queue after visibility timeout
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error polling messages');
  }
}

// =============================================================================
// Heartbeat
// =============================================================================

function updateHeartbeat(): void {
  try {
    fs.writeFileSync(config.heartbeatPath, Date.now().toString());
  } catch {
    // Ignore heartbeat errors
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  logger.info({ config: { ...config, queueUrl: '***' } }, 'Starting worker');

  if (!config.queueUrl) {
    logger.error('SQS_QUEUE_URL environment variable is required');
    process.exit(1);
  }

  // Graceful shutdown
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Shutting down worker');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Main loop
  while (!isShuttingDown) {
    updateHeartbeat();
    await pollMessages();

    // Small delay between polls (in addition to long polling)
    if (!isShuttingDown) {
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    }
  }
}

main().catch((error) => {
  logger.fatal({ error }, 'Worker crashed');
  process.exit(1);
});
