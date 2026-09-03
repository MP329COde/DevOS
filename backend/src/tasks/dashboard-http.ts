export interface DashboardHttpService {
  today(): Promise<unknown>;
  tomorrow(): Promise<unknown>;
}

export interface DashboardHttpResponse {
  status: number;
  body: unknown;
}

export async function handleDashboardRequest(method: string, path: string, service: DashboardHttpService): Promise<DashboardHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/dashboard/today') return { status: 200, body: await service.today() };
    if (method === 'GET' && path === '/api/dashboard/tomorrow') return { status: 200, body: await service.tomorrow() };
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid dashboard request' } };
  }
}
