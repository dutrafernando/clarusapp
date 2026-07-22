import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface ObjectStorageConfig {
  endpoint: string;
  port: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
  publicUrl: string;
}

function getObjectStorageConfig(): ObjectStorageConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT || '',
    port: process.env.MINIO_PORT || '9000',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.MINIO_BUCKET || '',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicUrl: process.env.MINIO_PUBLIC_URL || '',
  };
}

function parseDataUri(dataUri: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(dataUri);
  if (!match) {
    throw new Error('Data URI inválida para upload de objeto.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  return {
    mimeType,
    buffer: Buffer.from(isBase64 ? payload : decodeURIComponent(payload), isBase64 ? 'base64' : 'utf-8'),
  };
}

export function isObjectStorageConfigured(): boolean {
  const { endpoint, accessKey, secretKey, bucket } = getObjectStorageConfig();
  return Boolean(endpoint && accessKey && secretKey && bucket);
}

export async function uploadDataUriToObjectStorage(dataUri: string, prefix = 'uploads'): Promise<string | null> {
  if (!isObjectStorageConfigured()) {
    return null;
  }

  const config = getObjectStorageConfig();
  const { mimeType, buffer } = parseDataUri(dataUri);
  const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'bin';
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const client = new S3Client({
    region: 'us-east-1',
    endpoint: `${config.useSSL ? 'https' : 'http'}://${config.endpoint}:${config.port}`,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error: any) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === 404 || statusCode === 403 || error?.name === 'NotFound') {
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    } else {
      throw error;
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    })
  );

  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  return `${config.useSSL ? 'https' : 'http'}://${config.endpoint}:${config.port}/${config.bucket}/${key}`;
}
