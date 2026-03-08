import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Logger } from 'pino';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'mcp-search-packages';

interface AnalyticsAggregationPayload {
  period: 'hourly' | 'daily' | 'weekly';
  timestamp: string;
}

interface DownloadStats {
  totalDownloads: number;
  weeklyDownloads: number;
  dailyDownloads: number;
}

export async function handleAnalyticsAggregation(
  payload: AnalyticsAggregationPayload,
  logger: Logger
): Promise<void> {
  const { period, timestamp } = payload;

  logger.info({ period, timestamp }, 'Running analytics aggregation');

  // Get all packages that need aggregation
  const packages = await getPackagesForAggregation();

  logger.info({ packageCount: packages.length }, 'Found packages to aggregate');

  for (const pkg of packages) {
    try {
      const stats = await aggregatePackageStats(pkg.packageId, period, timestamp);
      await updatePackageStats(pkg.packageId, stats);
      logger.debug({ packageId: pkg.packageId, stats }, 'Updated package stats');
    } catch (error) {
      logger.error({ error, packageId: pkg.packageId }, 'Failed to aggregate package stats');
    }
  }

  logger.info({ period, packageCount: packages.length }, 'Analytics aggregation completed');
}

async function getPackagesForAggregation(): Promise<{ packageId: string }[]> {
  // Query for all published packages
  // In production, this would use pagination and potentially parallel processing

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pk': 'PACKAGES',
        ':status': 'published',
      },
      ProjectionExpression: 'packageId',
    })
  );

  return (result.Items || []) as { packageId: string }[];
}

async function aggregatePackageStats(
  packageId: string,
  period: string,
  timestamp: string
): Promise<DownloadStats> {
  // Calculate time ranges
  const now = new Date(timestamp);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Query download events
  // In production, this would query from a time-series table or CloudWatch metrics

  // Stub implementation
  const dailyDownloads = await countDownloads(packageId, dayAgo, now);
  const weeklyDownloads = await countDownloads(packageId, weekAgo, now);
  const totalDownloads = await getTotalDownloads(packageId);

  return {
    totalDownloads,
    weeklyDownloads,
    dailyDownloads,
  };
}

async function countDownloads(
  _packageId: string,
  _from: Date,
  _to: Date
): Promise<number> {
  // TODO: Implement actual download counting from analytics table
  // This would query a time-series table or CloudWatch metrics
  return 0;
}

async function getTotalDownloads(packageId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `PKG#${packageId}`,
        ':sk': 'META',
      },
      ProjectionExpression: 'stats.totalDownloads',
    })
  );

  return result.Items?.[0]?.stats?.totalDownloads || 0;
}

async function updatePackageStats(
  packageId: string,
  stats: DownloadStats
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PKG#${packageId}`,
        SK: 'META',
      },
      UpdateExpression: `
        SET stats.totalDownloads = :total,
            stats.weeklyDownloads = :weekly,
            stats.dailyDownloads = :daily,
            stats.lastAggregatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':total': stats.totalDownloads,
        ':weekly': stats.weeklyDownloads,
        ':daily': stats.dailyDownloads,
        ':now': new Date().toISOString(),
      },
    })
  );
}
