// ---------------------------------------------------------------------------
// WORLD CLOCKS
// Six timezone clocks displaying strategic monitoring station pun names.
// Updates every second via setInterval. Uses CLOCK_CITIES from humor config
// and formatTimeForZone from time utils.
// ---------------------------------------------------------------------------

import { h } from '../utils/dom.ts';
import { CLOCK_CITIES } from '../config/humor.ts';
import { formatTimeForZone } from '../utils/time.ts';

export class WorldClocks {
  private container: HTMLElement;
  private timeEls: HTMLElement[] = [];
  private dateEls: HTMLElement[] = [];
  private intervalId: number;

  constructor(container: HTMLElement) {
    this.container = container;

    const row = h('div', {
      className: 'world-clocks',
      style: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'space-between',
      },
    });

    for (const city of CLOCK_CITIES) {
      const nameEl = h('div', {
        className: 'clock-city-name',
        style: {
          fontSize: '9px',
          color: '#44ff88',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          textAlign: 'center',
        },
      }, city.pun);

      const timeEl = h('div', {
        className: 'clock-time',
        style: {
          fontSize: '14px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          textAlign: 'center',
        },
      });

      const dateEl = h('div', {
        className: 'clock-date',
        style: {
          fontSize: '9px',
          color: '#666666',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      });

      this.timeEls.push(timeEl);
      this.dateEls.push(dateEl);

      const clockWidget = h('div', {
        className: 'clock-widget',
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          minWidth: '0',
          flex: '1',
        },
      }, nameEl, timeEl, dateEl);

      row.appendChild(clockWidget);
    }

    this.container.appendChild(row);

    // Initial tick and start interval
    this.tick();
    this.intervalId = window.setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    for (let i = 0; i < CLOCK_CITIES.length; i++) {
      const { time, date } = formatTimeForZone(CLOCK_CITIES[i].tz);
      this.timeEls[i].textContent = time;
      this.dateEls[i].textContent = date;
    }
  }

  destroy(): void {
    clearInterval(this.intervalId);
  }
}
