export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDecimal(n: number, places: number = 1): string {
  return n.toFixed(places);
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(11, 19) + 'Z';
}

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCoordinates(lng: number, lat: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}${ns}, ${Math.abs(lng).toFixed(4)}${ew}`;
}

export function formatGridReference(lng: number, lat: number): string {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const letter = String.fromCharCode(65 + Math.floor((lat + 80) / 8));
  const easting = Math.floor(((lng + 180) % 6) * 100000 / 6);
  const northing = Math.floor(((lat + 80) % 8) * 100000 / 8);
  return `${zone}${letter} ${easting.toString().padStart(5, '0')} ${northing.toString().padStart(5, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function formatClassification(type: string): string {
  return type.split('-').map(w => w.toUpperCase()).join('-');
}
