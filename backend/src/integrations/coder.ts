export interface CoderClientOptions {
  baseUrl: string;
  token: string;
  organizationId: string;
  fetchImpl?: typeof fetch;
}

export interface CoderTemplate {
  id: string;
  name: string;
  display_name?: string;
}

export interface CoderWorkspace {
  id: string;
  name: string;
  latest_build: { status: string };
}

/** Thin client for the Coder REST API (templates, workspace lifecycle), authenticated via a session token. */
export class CoderClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: CoderClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listTemplates(): Promise<CoderTemplate[]> {
    return this.request<CoderTemplate[]>(`/api/v2/organizations/${encodeURIComponent(this.options.organizationId)}/templates`);
  }

  public async createWorkspace(templateId: string, name: string): Promise<CoderWorkspace> {
    return this.request<CoderWorkspace>(`/api/v2/organizations/${encodeURIComponent(this.options.organizationId)}/members/me/workspaces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, name }),
    });
  }

  public async getWorkspace(name: string): Promise<CoderWorkspace> {
    return this.request<CoderWorkspace>(`/api/v2/users/me/workspace/${encodeURIComponent(name)}`);
  }

  public async stopWorkspace(workspaceId: string): Promise<void> {
    await this.request(`/api/v2/workspaces/${encodeURIComponent(workspaceId)}/builds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transition: 'stop' }),
    });
  }

  public async startWorkspace(workspaceId: string): Promise<void> {
    await this.request(`/api/v2/workspaces/${encodeURIComponent(workspaceId)}/builds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transition: 'start' }),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { ...init, headers: { ...init?.headers, 'Coder-Session-Token': this.options.token } });
    if (!response.ok) throw new Error(`Coder API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}

/** Builds the vscode:// deep link that opens a ready Coder workspace directly in VS Code Desktop. */
export function buildVSCodeDesktopUri(baseUrl: string, owner: string, workspaceName: string): string {
  const params = new URLSearchParams({ url: baseUrl, owner, workspace: workspaceName });
  return `vscode://coder.coder-remote/open?${params.toString()}`;
}
