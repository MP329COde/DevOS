import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCalendarRequest, type CalendarSourceEvent } from './calendar-http.js';

test('lists combined calendar events', async () => {
  const events: CalendarSourceEvent[] = [{ uid: 'e1', title: 'Test', start: '2026-09-10T09:00:00Z', allDay: false, source: 'personal' }];
  const result = await handleCalendarRequest('GET', '/api/calendar/events', { listEvents: async () => events });
  assert.deepEqual(result, { status: 200, body: events });
});

test('rejects unknown routes', async () => {
  const result = await handleCalendarRequest('GET', '/api/calendar/unknown', { listEvents: async () => [] });
  assert.equal(result.status, 404);
});
