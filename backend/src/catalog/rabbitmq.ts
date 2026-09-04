export interface RabbitMQClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
}

export interface RabbitMQQueue {
  name: string;
  vhost: string;
  messages: number;
  consumers: number;
  state: string;
}

export interface RabbitMQNode {
  name: string;
  running: boolean;
  mem_used: number;
  disk_free: number;
}

/** Read-only client for the RabbitMQ HTTP management API (queues, nodes), authenticated via HTTP Basic. */
export class RabbitMQClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: RabbitMQClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listQueues(): Promise<RabbitMQQueue[]> {
    return this.request<RabbitMQQueue[]>('/api/queues');
  }

  public async listNodes(): Promise<RabbitMQNode[]> {
    return this.request<RabbitMQNode[]>('/api/nodes');
  }

  private async request<T>(path: string): Promise<T> {
    const credentials = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      headers: { authorization: `Basic ${credentials}` },
    });
    if (!response.ok) throw new Error(`RabbitMQ API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
