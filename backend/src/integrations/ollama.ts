export interface OllamaClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

/** Thin read-only client for a local Ollama HTTP API (no authentication, homelab-local usage). */
export class OllamaClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: OllamaClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listModels(): Promise<OllamaModel[]> {
    const response = await this.request<{ models: Array<{ name: string; size: number; modified_at: string }> }>('/api/tags');
    return response.models.map((model) => ({ name: model.name, size: model.size, modified_at: model.modified_at }));
  }

  public async generate(model: string, prompt: string): Promise<string> {
    const response = await this.request<{ response: string }>('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    return response.response;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, init);
    if (!response.ok) throw new Error(`Ollama API request failed (${response.status})`);
    return (await response.json()) as T;
  }
}
