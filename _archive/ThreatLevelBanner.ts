// ---------------------------------------------------------------------------
// THREAT LEVEL BANNER
// 5-segment horizontal threat level bar. Active segment highlighted with
// full color and gentle pulse; inactive segments dimmed. Subscribes to the
// dashboardStore threatLevel slice for live updates.
// ---------------------------------------------------------------------------

import type { ThreatLevel } from '../types/index.ts';
import { h } from '../utils/dom.ts';
import { dashboardStore, subscribe } from '../store/dashboardStore.ts';

const SEGMENTS: { level: ThreatLevel; label: string; color: string }[] = [
  { level: 'LOW',      label: 'LOW',      color: '#3388ff' },
  { level: 'GUARDED',  label: 'GUARDED',  color: '#44aa44' },
  { level: 'ELEVATED', label: 'ELEVATED', color: '#ffaa00' },
  { level: 'SEVERE',   label: 'SEVERE',   color: '#ff8800' },
  { level: 'CRITICAL', label: 'CRITICAL', color: '#ff4444' },
];

export class ThreatLevelBanner {
  private container: HTMLElement;
  private segmentEls: HTMLElement[] = [];
  private unsubscribe: () => void;

  constructor(container: HTMLElement) {
    this.container = container;

    const bar = h('div', {
      className: 'threat-level-banner',
      style: {
        display: 'flex',
        width: '100%',
        height: '36px',
        gap: '2px',
      },
    });

    for (const seg of SEGMENTS) {
      const el = h('div', {
        className: 'threat-segment',
        style: {
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: seg.color,
          color: '#fff',
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          opacity: '0.2',
          transition: 'opacity 0.4s ease',
        },
        dataset: { level: seg.level },
      }, seg.label);

      this.segmentEls.push(el);
      bar.appendChild(el);
    }

    this.container.appendChild(bar);

    // Initial render
    this.update(dashboardStore.getState().threatLevel);

    // Subscribe to changes
    this.unsubscribe = subscribe(
      (s) => s.threatLevel,
      (level) => this.update(level),
    );
  }

  private update(active: ThreatLevel): void {
    for (let i = 0; i < this.segmentEls.length; i++) {
      const el = this.segmentEls[i];
      const seg = SEGMENTS[i];
      const isActive = seg.level === active;

      el.style.opacity = isActive ? '1' : '0.2';
      el.style.animation = isActive
        ? 'threat-pulse 2s ease-in-out infinite'
        : 'none';
    }
  }

  destroy(): void {
    this.unsubscribe();
  }
}
