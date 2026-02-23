export function nowUtc(): number {
  return Date.now();
}

export function isWithinRange(timestamp: number, range: string): boolean {
  const now = Date.now();
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': Infinity,
  };
  return now - timestamp <= (ranges[range] ?? Infinity);
}

export function localHourAtCoord(lng: number): number {
  const utcHour = new Date().getUTCHours();
  return Math.floor(((lng + 180) / 360) * 24 + utcHour) % 24;
}

export function formatTimeForZone(tz: string): { time: string; date: string } {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
  return { time, date };
}
