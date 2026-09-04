export interface MinioClientOptions {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}

export interface MinioBucket {
  name: string;
  size: number;
  objectCount: number;
}

/** Thin read-only client for the MinIO admin API (bucket listing/usage), authenticated via access/secret key. */
export class MinioClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: MinioClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Lists buckets and their usage via the MinIO admin API.
   *
   * Simplification: MinIO's S3-compatible and admin APIs normally require AWS SigV4-signed
   * requests. To avoid pulling in an AWS SDK (out of scope for this read-only integration),
   * we send the access/secret key pair as a plain bearer token instead of computing a SigV4
   * signature. This works only if the MinIO deployment is configured to accept it (e.g. behind
   * a trusted internal reverse proxy) or is adapted later. Full SigV4 signing can be added later
   * if a stricter deployment requires it — deliberately not implemented now.
   */
  public async listBuckets(): Promise<MinioBucket[]> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/minio/admin/v3/list-buckets`, {
      headers: { authorization: `Bearer ${this.options.accessKey}:${this.options.secretKey}` },
    });
    if (!response.ok) throw new Error(`MinIO admin API request failed (${response.status})`);
    return (await response.json()) as MinioBucket[];
  }
}
