import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  type GetCommandInput,
  type PutCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type ScanCommandInput,
  type BatchGetCommandInput,
  type BatchWriteCommandInput,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config.js';
import { logger } from '../logger.js';

// =============================================================================
// Client Setup
// =============================================================================

const dynamoDBClient = new DynamoDBClient({
  region: config.aws.region,
  credentials: config.aws.credentials,
  endpoint: config.dynamodb.endpoint,
});

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// =============================================================================
// Table Name Helper
// =============================================================================

export const TABLE_NAME = config.dynamodb.tableName;

// =============================================================================
// Typed Operations
// =============================================================================

export async function getItem<T>(
  params: Omit<GetCommandInput, 'TableName'>
): Promise<T | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
    return (result.Item as T) || null;
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB getItem error');
    throw error;
  }
}

export async function putItem<T extends Record<string, unknown>>(
  params: Omit<PutCommandInput, 'TableName'> & { Item: T }
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB putItem error');
    throw error;
  }
}

export async function updateItem(
  params: Omit<UpdateCommandInput, 'TableName'>
): Promise<Record<string, unknown> | undefined> {
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
    return result.Attributes;
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB updateItem error');
    throw error;
  }
}

export async function deleteItem(
  params: Omit<DeleteCommandInput, 'TableName'>
): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB deleteItem error');
    throw error;
  }
}

export async function query<T>(
  params: Omit<QueryCommandInput, 'TableName'>
): Promise<{ items: T[]; lastKey?: Record<string, unknown> }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
    return {
      items: (result.Items as T[]) || [],
      lastKey: result.LastEvaluatedKey,
    };
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB query error');
    throw error;
  }
}

export async function queryAll<T>(
  params: Omit<QueryCommandInput, 'TableName'>
): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await query<T>({
      ...params,
      ExclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  return items;
}

export async function scan<T>(
  params: Omit<ScanCommandInput, 'TableName'> = {}
): Promise<{ items: T[]; lastKey?: Record<string, unknown> }> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ...params,
      })
    );
    return {
      items: (result.Items as T[]) || [],
      lastKey: result.LastEvaluatedKey,
    };
  } catch (error) {
    logger.error({ error, params }, 'DynamoDB scan error');
    throw error;
  }
}

export async function batchGet<T>(
  keys: Record<string, unknown>[]
): Promise<T[]> {
  if (keys.length === 0) return [];

  // DynamoDB batch get limit is 100 items
  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < keys.length; i += 100) {
    batches.push(keys.slice(i, i + 100));
  }

  const results: T[] = [];

  for (const batch of batches) {
    try {
      const params: BatchGetCommandInput = {
        RequestItems: {
          [TABLE_NAME]: {
            Keys: batch,
          },
        },
      };

      const result = await docClient.send(new BatchGetCommand(params));
      const items = result.Responses?.[TABLE_NAME] as T[];
      if (items) {
        results.push(...items);
      }
    } catch (error) {
      logger.error({ error, batch }, 'DynamoDB batchGet error');
      throw error;
    }
  }

  return results;
}

export async function batchWrite(
  operations: Array<
    | { type: 'put'; item: Record<string, unknown> }
    | { type: 'delete'; key: Record<string, unknown> }
  >
): Promise<void> {
  if (operations.length === 0) return;

  // DynamoDB batch write limit is 25 items
  const batches: typeof operations[] = [];
  for (let i = 0; i < operations.length; i += 25) {
    batches.push(operations.slice(i, i + 25));
  }

  for (const batch of batches) {
    try {
      const params: BatchWriteCommandInput = {
        RequestItems: {
          [TABLE_NAME]: batch.map((op) => {
            if (op.type === 'put') {
              return { PutRequest: { Item: op.item } };
            } else {
              return { DeleteRequest: { Key: op.key } };
            }
          }),
        },
      };

      await docClient.send(new BatchWriteCommand(params));
    } catch (error) {
      logger.error({ error, batch }, 'DynamoDB batchWrite error');
      throw error;
    }
  }
}

export async function transactWrite(
  params: Omit<TransactWriteCommandInput, 'TableName'>
): Promise<void> {
  try {
    await docClient.send(new TransactWriteCommand(params));
  } catch (error) {
    logger.error({ error }, 'DynamoDB transactWrite error');
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

export function buildUpdateExpression(
  updates: Record<string, unknown>
): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];

  Object.entries(updates).forEach(([key, value], index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;
    names[nameKey] = key;

    if (value === undefined || value === null) {
      removeExpressions.push(nameKey);
    } else {
      values[valueKey] = value;
      setExpressions.push(`${nameKey} = ${valueKey}`);
    }
  });

  const expressions: string[] = [];
  if (setExpressions.length > 0) {
    expressions.push(`SET ${setExpressions.join(', ')}`);
  }
  if (removeExpressions.length > 0) {
    expressions.push(`REMOVE ${removeExpressions.join(', ')}`);
  }

  return {
    UpdateExpression: expressions.join(' '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

export function encodeLastKey(
  lastKey: Record<string, unknown> | undefined
): string | undefined {
  if (!lastKey) return undefined;
  return Buffer.from(JSON.stringify(lastKey)).toString('base64url');
}

export function decodeLastKey(
  cursor: string | undefined
): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    return undefined;
  }
}
