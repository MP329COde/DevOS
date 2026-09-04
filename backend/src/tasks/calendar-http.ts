export interface CalendarSourceEvent {
  uid: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: 'personal' | 'professional';
}

export interface CalendarHttpService {
  listEvents(): Promise<CalendarSourceEvent[]>;
}

export interface CalendarHttpResponse {
  status: number;
  body: unknown;
}

export async function handleCalendarRequest(method: string, path: string, service: CalendarHttpService): Promise<CalendarHttpResponse> {
  try {
    if (method === 'GET' && path === '/api/calendar/events') {
      return { status: 200, body: await service.listEvents() };
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid calendar request' } };
  }
}
