export interface IcsEvent {
  uid: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
}

/**
 * Minimal read-only ICS (RFC 5545) parser: extracts UID/SUMMARY/DTSTART/DTEND from VEVENT
 * blocks. No recurrence expansion (RRULE), no timezone database — DTSTART/DTEND are taken
 * as-is (UTC "Z" suffix or floating), which covers the common case of a calendar export.
 * This is intentionally not a full ICS implementation.
 */
export function parseIcsCalendar(raw: string): IcsEvent[] {
  const unfolded = unfoldLines(raw);
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> & { allDayFlag?: boolean } | null = null;

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.uid && current.title && current.start) {
        events.push({ uid: current.uid, title: current.title, start: current.start, end: current.end, allDay: Boolean(current.allDayFlag) });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(';')[0];

    if (key === 'UID') current.uid = value;
    else if (key === 'SUMMARY') current.title = unescapeText(value);
    else if (key === 'DTSTART') { current.start = parseIcsDate(value); current.allDayFlag = !rawKey.includes('VALUE=DATE-TIME') && /^\d{8}$/.test(value); }
    else if (key === 'DTEND') current.end = parseIcsDate(value);
  }

  return events;
}

async function fetchIcs(url: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`ICS calendar fetch failed (${response.status})`);
  return response.text();
}

export async function fetchIcsEvents(url: string, fetchImpl: typeof fetch = fetch): Promise<IcsEvent[]> {
  return parseIcsCalendar(await fetchIcs(url, fetchImpl));
}

function unfoldLines(raw: string): string[] {
  const rawLines = raw.split(/\r\n|\n|\r/);
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcsDate(value: string): string {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return value;
  const [, year, month, day, hour, minute, second, zulu] = match;
  if (!hour) return `${year}-${month}-${day}`;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${zulu ? 'Z' : ''}`;
}
