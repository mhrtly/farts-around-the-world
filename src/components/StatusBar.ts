// ---------------------------------------------------------------------------
// STATUS BAR
// Full-width bottom status bar displaying system operational status,
// last update timestamp, and live event metrics. Green blinking dots
// indicate active subsystems.
// ---------------------------------------------------------------------------

import { h } from '../utils/dom.ts';
import { formatNumber, formatTimestamp } from '../utils/format.ts';
import { dashboardStore, subscribe } from '../store/dashboardStore.ts';

export class StatusBar {
  private container: HTMLElement;
  private lastUpdateEl: HTMLElement;
  private eventsTodayEl: HTMLElement;
  private eventsPerMinEl: HTMLElement;
  private unsubEventsToday: () => void;
  private unsubEventsPerMin: () => void;
  private unsubLastUpdate: () => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // Left group: system status indicators
    const leftGroup = h('div', {
      className: 'status-group status-left',
      style: { display: 'flex', alignItems: 'center', gap: '16px' },
    },
      this.statusItem('SENSOR ARRAY: ONLINE'),
      this.statusItem('SATELLITES: 47/47'),
      this.statusItem('OLFACTORY GRID: NOMINAL'),
    );

    // Center group: last update timestamp
    this.lastUpdateEl = h('span', { className: 'status-value' });
    const centerGroup = h('div', {
      className: 'status-group status-center',
      style: { display: 'flex', alignItems: 'center', gap: '4px' },
    },
      h('span', { className: 'status-label' }, 'LAST UPDATE: '),
      this.lastUpdateEl,
    );

    // Right group: event metrics
    this.eventsTodayEl = h('span', { className: 'status-value' });
    this.eventsPerMinEl = h('span', { className: 'status-value' });

    const rightGroup = h('div', {
      className: 'status-group status-right',
      style: { display: 'flex', alignItems: 'center', gap: '16px' },
    },
      h('span', null,
        h('span', { className: 'status-label' }, 'EVENTS TODAY: '),
        this.eventsTodayEl,
      ),
      h('span', null,
        h('span', { className: 'status-label' }, 'EVENTS/MIN: '),
        this.eventsPerMinEl,
      ),
      h('span', { className: 'status-label' }, 'ACTIVE SENSORS: 12,847'),
    );

    // Assemble bar
    const bar = h('div', {
      className: 'status-bar',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#888888',
        padding: '4px 12px',
        boxSizing: 'border-box',
      },
    }, leftGroup, centerGroup, rightGroup);

    this.container.appendChild(bar);

    // Initial render
    const state = dashboardStore.getState();
    this.updateLastUpdate(state.lastUpdate);
    this.updateEventsToday(state.eventsToday);
    this.updateEventsPerMin(state.eventsPerMinute);

    // Subscribe
    this.unsubLastUpdate = subscribe(
      (s) => s.lastUpdate,
      (ts) => this.updateLastUpdate(ts),
    );
    this.unsubEventsToday = subscribe(
      (s) => s.eventsToday,
      (n) => this.updateEventsToday(n),
    );
    this.unsubEventsPerMin = subscribe(
      (s) => s.eventsPerMinute,
      (n) => this.updateEventsPerMin(n),
    );
  }

  private statusItem(label: string): HTMLElement {
    const dot = h('span', {
      className: 'status-dot online',
      style: {
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: '#44ff88',
        marginRight: '6px',
        animation: 'status-blink 2s ease-in-out infinite',
      },
    });
    return h('span', {
      style: { display: 'inline-flex', alignItems: 'center' },
    }, dot, label);
  }

  private updateLastUpdate(ts: number): void {
    this.lastUpdateEl.textContent = formatTimestamp(ts);
  }

  private updateEventsToday(n: number): void {
    this.eventsTodayEl.textContent = formatNumber(n);
  }

  private updateEventsPerMin(n: number): void {
    this.eventsPerMinEl.textContent = formatNumber(n);
  }

  destroy(): void {
    this.unsubLastUpdate();
    this.unsubEventsToday();
    this.unsubEventsPerMin();
  }
}
