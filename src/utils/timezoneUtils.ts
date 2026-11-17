export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'UTC+3', label: 'UTC +3:00' },
  { value: 'UTC+2', label: 'UTC +2:00' },
  { value: 'UTC+1', label: 'UTC +1:00' },
  { value: 'UTC+0', label: 'UTC +0:00' },
  { value: 'UTC+4', label: 'UTC +4:00' },
  { value: 'UTC+5', label: 'UTC +5:00' },
  { value: 'UTC+6', label: 'UTC +6:00' },
  { value: 'UTC-3', label: 'UTC -3:00' },
  { value: 'UTC-4', label: 'UTC -4:00' },
  { value: 'UTC-5', label: 'UTC -5:00' },
  { value: 'UTC-8', label: 'UTC -8:00' },
];

export function normalizeTimezoneValue(tz?: string): string {
  const clean = (tz || '').trim();
  if (!clean) return 'UTC+3';
  const m = clean.toUpperCase().match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?00)?$/);
  if (m) {
    return `UTC${m[1]}${Number(m[2])}`;
  }
  return clean;
}

export function parseUtcOffsetMinutesClient(tz?: string): number | null {
  const clean = (tz || '').trim().toUpperCase();
  if (!clean || clean === 'UTC' || clean === 'GMT') return clean ? 0 : 180;
  const match = clean.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const mins = match[3] ? Number(match[3]) : 0;
  if (isNaN(hours) || isNaN(mins) || hours > 14 || mins >= 60) return null;
  return sign * (hours * 60 + mins);
}

export function formatUtcOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC ${sign}${h}:${String(m).padStart(2, '0')}`;
}

export function getBrowserLocationSummary(): { timeZone: string; offsetLabel: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    // JS getTimezoneOffset() returns (UTC - local) in minutes, so negate it for UTC+offset
    const localOffsetMin = -new Date().getTimezoneOffset();
    return {
      timeZone: tz,
      offsetLabel: formatUtcOffsetLabel(localOffsetMin),
    };
  } catch {
    return {
      timeZone: 'UTC',
      offsetLabel: 'UTC +0:00',
    };
  }
}

export function formatTimestampInZone(
  timestampMs: number,
  tz: string = 'UTC+3',
  options?: { includeDate?: boolean }
): string {
  const safeMs = Number.isFinite(timestampMs) && timestampMs > 0 ? timestampMs : Date.now();
  const includeDate = Boolean(options?.includeDate);
  const offsetMin = parseUtcOffsetMinutesClient(tz || 'UTC+3');
  if (offsetMin !== null) {
    const shifted = new Date(safeMs + offsetMin * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timePart = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
    if (!includeDate) return timePart;
    const datePart = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
    return `${datePart} ${timePart}`;
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      ...(includeDate ? { year: 'numeric', month: '2-digit', day: '2-digit' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(new Date(safeMs));
  } catch {
    const shifted = new Date(safeMs + 180 * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timePart = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
    if (!includeDate) return timePart;
    const datePart = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
    return `${datePart} ${timePart}`;
  }
}
