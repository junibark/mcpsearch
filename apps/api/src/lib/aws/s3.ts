import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { logger } from '../logger.js';

// =============================================================================
// Client Setup
// =============================================================================

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: config.aws.credentials,
  endpoint: config.dynamodb.endpoint, // Use same endpoint for LocalStack
  forcePathStyle: !!config.dynamodb.endpoint, // Required for LocalStack
});

// =============================================================================
// Bucket Names
// =============================================================================

export const PACKAGES_BUCKET = config.s3.packagesBucket;
export const ASSETS_BUCKET = config.s3.assetsBucket;

// =============================================================================
// Upload Operations
// =============================================================================

export async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer | string | ReadableStream,
  options: Partial<PutObjectCommandInput> = {}
): Promise<void> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ...options,
      })
    );
    logger.debug({ bucket, key }, 'S3 object uploaded');
  } catch (error) {
    logger.error({ error, bucket, key }, 'S3 upload error');
    throw error;
  }
}

export async function uploadPackage(
  packageId: string,
  version: string,
  tarball: Buffer
): Promise<string> {
  const key = `packages/${packageId}/${version}/package.tgz`;

  await uploadObject(PACKAGES_BUCKET, key, tarball, {
    ContentType: 'application/gzip',
    Metadata: {
      'package-id': packageId,
      'package-version': version,
    },
  });

  return key;
}

// =============================================================================
// Download Operations
// =============================================================================

export async function getObject(
  bucket: string,
  key: string
): Promise<{ body: ReadableStream; contentType?: string; contentLength?: number } | null> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!result.Body) return null;

    return {
      body: result.Body as unknown as ReadableStream,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    logger.error({ error, bucket, key }, 'S3 getObject error');
    throw error;
  }
}

export async function getObjectAsBuffer(
  bucket: string,
  key: string
): Promise<Buffer | null> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!result.Body) return null;

    const chunks: Uint8Array[] = [];
    const reader = (result.Body as ReadableStream).getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    logger.error({ error, bucket, key }, 'S3 getObjectAsBuffer error');
    throw error;
  }
}

// =============================================================================
// Presigned URLs
// =============================================================================

export async function getUploadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600,
  options: Partial<PutObjectCommandInput> = {}
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ...options,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getDownloadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600,
  options: Partial<GetObjectCommandInput> = {}
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...options,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getPackageUploadUrl(
  packageId: string,
  version: string,
  expiresIn: number = 3600
): Promise<{ url: string; key: string }> {
  const key = `packages/${packageId}/${version}/package.tgz`;
  const url = await getUploadUrl(PACKAGES_BUCKET, key, expiresIn, {
    ContentType: 'application/gzip',
  });

  return { url, key };
}

export async function getPackageDownloadUrl(
  packageId: string,
  version: string,
  expiresIn: number = 3600
): Promise<string> {
  const key = `packages/${packageId}/${version}/package.tgz`;
  return getDownloadUrl(PACKAGES_BUCKET, key, expiresIn);
}

// =============================================================================
// Object Info
// =============================================================================

export async function objectExists(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

export async function getObjectMetadata(
  bucket: string,
  key: string
): Promise<{
  contentLength: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
} | null> {
  try {
    const result = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return {
      contentLength: result.ContentLength || 0,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      metadata: result.Metadata,
    };
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

// =============================================================================
// Delete Operations
// =============================================================================

export async function deleteObject(
  bucket: string,
  key: string
): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    logger.debug({ bucket, key }, 'S3 object deleted');
  } catch (error) {
    logger.error({ error, bucket, key }, 'S3 deleteObject error');
    throw error;
  }
}

// =============================================================================
// List Operations
// =============================================================================

export async function listObjects(
  bucket: string,
  prefix: string,
  maxKeys: number = 1000
): Promise<{ key: string; size: number; lastModified?: Date }[]> {
  try {
    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })
    );

    return (result.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified,
    }));
  } catch (error) {
    logger.error({ error, bucket, prefix }, 'S3 listObjects error');
    throw error;
  }
}

export async function listPackageVersions(
  packageId: string
): Promise<string[]> {
  const prefix = `packages/${packageId}/`;
  const objects = await listObjects(PACKAGES_BUCKET, prefix);

  const versions = new Set<string>();
  for (const obj of objects) {
    // Extract version from key: packages/{packageId}/{version}/package.tgz
    const match = obj.key.match(/^packages\/[^/]+\/([^/]+)\//);
    if (match) {
      versions.add(match[1]);
    }
  }

  return Array.from(versions);
}

// =============================================================================
// Copy Operations
// =============================================================================

export async function copyObject(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
): Promise<void> {
  try {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: destBucket,
        Key: destKey,
        CopySource: `${sourceBucket}/${sourceKey}`,
      })
    );
    logger.debug({ sourceBucket, sourceKey, destBucket, destKey }, 'S3 object copied');
  } catch (error) {
    logger.error({ error, sourceBucket, sourceKey }, 'S3 copyObject error');
    throw error;
  }
}
