export interface RedpandaClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface RedpandaBroker {
  node_id: number;
  num_cores: number;
  membership_status: string;
}

export interface RedpandaTopic {
  topic_name: string;
  partition_count: number;
  replication_factor: number;
}

export interface RedpandaPartition {
  partition_id: number;
  leader_id: number;
  replicas: number[];
}

/** Read-only client for the Redpanda Admin API (brokers, topics, partitions), optionally authenticated via a Bearer token. */
export class RedpandaClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: RedpandaClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listBrokers(): Promise<RedpandaBroker[]> {
    return this.request<RedpandaBroker[]>('/v1/brokers');
  }

  public async listTopics(): Promise<RedpandaTopic[]> {
    return this.request<RedpandaTopic[]>('/v1/topics');
  }

  public async getTopicPartitions(topic: string): Promise<RedpandaPartition[]> {
    return this.request<RedpandaPartition[]>(`/v1/topics/${encodeURIComponent(topic)}/partitions`);
  }

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.options.token) {
      headers.authorization = `Bearer ${this.options.token}`;
    }
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers });
    if (!response.ok) throw new Error(`Redpanda Admin API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
