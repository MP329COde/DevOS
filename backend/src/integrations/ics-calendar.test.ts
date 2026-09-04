import assert from 'node:assert/strict';
import test from 'node:test';

import { parseIcsCalendar, fetchIcsEvents } from './ics-calendar.js';

test('parses a simple VEVENT with a timed start/end', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:event-1@example.com',
    'SUMMARY:Réunion équipe',
    'DTSTART:20260910T140000Z',
    'DTEND:20260910T150000Z',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  assert.deepEqual(parseIcsCalendar(ics), [
    { uid: 'event-1@example.com', title: 'Réunion équipe', start: '2026-09-10T14:00:00Z', end: '2026-09-10T15:00:00Z', allDay: false },
  ]);
});

test('parses an all-day VEVENT (DATE value, no time component)', () => {
  const ics = ['BEGIN:VEVENT', 'UID:event-2@example.com', 'SUMMARY:Congé', 'DTSTART;VALUE=DATE:20260915', 'END:VEVENT'].join('\r\n');

  assert.deepEqual(parseIcsCalendar(ics), [
    { uid: 'event-2@example.com', title: 'Congé', start: '2026-09-15', end: undefined, allDay: true },
  ]);
});

test('unfolds continuation lines per RFC 5545', () => {
  const ics = ['BEGIN:VEVENT', 'UID:event-3@example.com', 'SUMMARY:Long titre qui contin', ' ue sur la ligne suivante', 'DTSTART:20260910T090000Z', 'END:VEVENT'].join('\r\n');

  const events = parseIcsCalendar(ics);
  assert.equal(events[0].title, 'Long titre qui continue sur la ligne suivante');
});

test('unescapes commas, semicolons and backslashes in text fields', () => {
  const ics = ['BEGIN:VEVENT', 'UID:event-4@example.com', 'SUMMARY:A\\, B\\; C\\\\D', 'DTSTART:20260910T090000Z', 'END:VEVENT'].join('\r\n');

  assert.equal(parseIcsCalendar(ics)[0].title, 'A, B; C\\D');
});

test('ignores an incomplete VEVENT missing a required field', () => {
  const ics = ['BEGIN:VEVENT', 'UID:event-5@example.com', 'DTSTART:20260910T090000Z', 'END:VEVENT'].join('\r\n');
  assert.deepEqual(parseIcsCalendar(ics), []);
});

test('fetchIcsEvents fetches then parses the calendar body', async () => {
  const events = await fetchIcsEvents('https://calendar.test/personal.ics', async () =>
    new Response(['BEGIN:VEVENT', 'UID:e@x.com', 'SUMMARY:Test', 'DTSTART:20260910T090000Z', 'END:VEVENT'].join('\r\n'), { status: 200 }));
  assert.equal(events.length, 1);
});

test('fetchIcsEvents throws when the calendar URL is unreachable', async () => {
  await assert.rejects(() => fetchIcsEvents('https://calendar.test/missing.ics', async () => new Response(null, { status: 404 })), /404/);
});
