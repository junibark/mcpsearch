import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { Logger } from 'pino';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'mcp-search-packages';
const PACKAGES_BUCKET = process.env.PACKAGES_BUCKET || 'mcp-search-packages';

interface PackagePublishPayload {
  packageId: string;
  version: string;
  publisherId: string;
}

export async function handlePackagePublish(
  payload: PackagePublishPayload,
  logger: Logger
): Promise<void> {
  const { packageId, version, publisherId } = payload;

  logger.info({ packageId, version, publisherId }, 'Processing package publish');

  // Verify package exists in S3
  const s3Key = `packages/${packageId}/${version}/package.tgz`;

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: PACKAGES_BUCKET,
        Key: s3Key,
      })
    );
  } catch (error) {
    logger.error({ error, s3Key }, 'Package not found in S3');
    throw new Error(`Package not found: ${s3Key}`);
  }

  // Update package status to published
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PKG#${packageId}`,
        SK: 'META',
      },
      UpdateExpression: `
        SET #status = :status,
            latestVersion = :version,
            updatedAt = :now
      `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'published',
        ':version': version,
        ':now': new Date().toISOString(),
      },
    })
  );

  // Update version status
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PKG#${packageId}`,
        SK: `VERSION#${version}`,
      },
      UpdateExpression: `
        SET #status = :status,
            publishedAt = :now
      `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'published',
        ':now': new Date().toISOString(),
      },
    })
  );

  logger.info({ packageId, version }, 'Package published successfully');
}
