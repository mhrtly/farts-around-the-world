export function classificationColor(type: string): string {
  const colors: Record<string, string> = {
    'silent-but-deadly': '#ff0040',
    'thunderclap': '#ff4400',
    'squeaker': '#ffdd00',
    'rumbler': '#ff8800',
    'machine-gun': '#ff6622',
    'the-leaker': '#88aa00',
    'wet-warning': '#8b4513',
    'phantom': '#9966cc',
    'crop-duster': '#44aaff',
    'unclassified': '#888888',
  };
  return colors[type] ?? '#888888';
}

export function classificationColorRgba(type: string): [number, number, number, number] {
  const hex = classificationColor(type);
  return hexToRgba(hex, 200);
}

export function threatColor(level: string): string {
  const colors: Record<string, string> = {
    'CRITICAL': '#ff4444',
    'SEVERE': '#ff8800',
    'ELEVATED': '#ffaa00',
    'GUARDED': '#44aa44',
    'LOW': '#3388ff',
  };
  return colors[level] ?? '#888888';
}

export function gasconColor(level: number): string {
  const colors: Record<number, string> = {
    1: '#ff0040',
    2: '#ff4400',
    3: '#ffaa00',
    4: '#00aaff',
    5: '#2d8a6e',
  };
  return colors[level] ?? '#888888';
}

export function gfiColor(score: number): string {
  if (score <= 25) return '#2d8a6e';
  if (score <= 50) return '#44aa44';
  if (score <= 75) return '#ffaa00';
  if (score <= 90) return '#ff4400';
  return '#ff0040';
}

export function hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

export function interpolateColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgba(color1);
  const [r2, g2, b2] = hexToRgba(color2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
