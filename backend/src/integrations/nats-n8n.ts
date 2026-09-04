export interface NatsMonitorClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface NatsVarz {
  server_id: string;
  connections: number;
  in_msgs: number;
  out_msgs: number;
}

export interface NatsConnection {
  cid: number;
  ip: string;
  subscriptions: number;
}

/** Read-only client for the NATS server's built-in HTTP monitoring endpoint (unauthenticated). */
export class NatsMonitorClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: NatsMonitorClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async getVarz(): Promise<NatsVarz> {
    const varz = await this.request<{ server_id: string; connections: number; in_msgs: number; out_msgs: number }>('/varz');
    return { server_id: varz.server_id, connections: varz.connections, in_msgs: varz.in_msgs, out_msgs: varz.out_msgs };
  }

  public async listConnections(): Promise<NatsConnection[]> {
    const connz = await this.request<{ connections: Array<{ cid: number; ip: string; subscriptions: number }> }>('/connz');
    return connz.connections.map((connection) => ({ cid: connection.cid, ip: connection.ip, subscriptions: connection.subscriptions }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`);
    if (!response.ok) throw new Error(`NATS monitoring API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}

export interface N8nClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
}

export interface N8nExecution {
  id: string;
  status: string;
  startedAt: string;
}

/** Read-only client for the n8n REST API, authenticated via the X-N8N-API-KEY header. */
export class N8nClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: N8nClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listWorkflows(): Promise<N8nWorkflow[]> {
    const body = await this.request<{ data: Array<{ id: string; name: string; active: boolean }> }>('/api/v1/workflows');
    return body.data.map((workflow) => ({ id: workflow.id, name: workflow.name, active: workflow.active }));
  }

  public async listExecutions(workflowId: string): Promise<N8nExecution[]> {
    const body = await this.request<{ data: Array<{ id: string; status: string; startedAt: string }> }>(
      `/api/v1/executions?workflowId=${encodeURIComponent(workflowId)}`,
    );
    return body.data.map((execution) => ({ id: execution.id, status: execution.status, startedAt: execution.startedAt }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      headers: { 'x-n8n-api-key': this.options.apiKey },
    });
    if (!response.ok) throw new Error(`n8n API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
