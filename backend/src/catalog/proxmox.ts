export interface ProxmoxClientOptions {
  baseUrl: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}

export interface ProxmoxNode {
  id: string;
  status: string;
  cpu?: number;
  mem?: number;
}

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
}

export interface ProxmoxContainer {
  vmid: number;
  name: string;
  status: string;
}

interface ProxmoxResponse<T> {
  data: T;
}

/** Thin read-only client for the Proxmox VE API (nodes, VMs, containers), authenticated via an API token. */
export class ProxmoxClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: ProxmoxClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listNodes(): Promise<ProxmoxNode[]> {
    const list = await this.request<Array<{ node: string; status: string; cpu?: number; mem?: number }>>('/api2/json/nodes');
    return list.map((node) => ({ id: node.node, status: node.status, cpu: node.cpu, mem: node.mem }));
  }

  public async listVirtualMachines(node: string): Promise<ProxmoxVM[]> {
    const list = await this.request<Array<{ vmid: number; name: string; status: string }>>(`/api2/json/nodes/${encodeURIComponent(node)}/qemu`);
    return list.map((vm) => ({ vmid: vm.vmid, name: vm.name, status: vm.status }));
  }

  public async listContainers(node: string): Promise<ProxmoxContainer[]> {
    const list = await this.request<Array<{ vmid: number; name: string; status: string }>>(`/api2/json/nodes/${encodeURIComponent(node)}/lxc`);
    return list.map((container) => ({ vmid: container.vmid, name: container.name, status: container.status }));
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: { authorization: `PVEAPIToken=${this.options.apiToken}` } });
    if (!response.ok) throw new Error(`Proxmox API request failed (${response.status})`);
    const body = (await response.json()) as ProxmoxResponse<T>;
    return body.data;
  }
}
