// ---------------------------------------------------------------------------
// TOP PRODUCING NATIONS PANEL
// Displays a ranked table of the top 15 nations by gas event count.
// Columns: Rank | Flag | Country | Events (24h) | Avg Intensity | Trend
// Horizontal bar behind event count cells proportional to max. Trend arrows
// are red (up) or green (down). Recalculates on every store events update.
// ---------------------------------------------------------------------------

import type { GasEvent } from '../types/index.ts';
import { h, replaceChildren } from '../utils/dom.ts';
import { formatNumber } from '../utils/format.ts';
import { getTopProducers } from '../services/MetricsCalculator.ts';
import { dashboardStore, subscribe } from '../store/dashboardStore.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a two-letter country code to a flag emoji. */
function flagEmoji(code: string): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class TopProducersPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private unsubscribe: () => void;

  constructor(container: HTMLElement) {
    this.contentEl = h('div', { className: 'panel-content' });

    this.el = h('div', { className: 'panel' },
      h('div', { className: 'panel-header' },
        h('span', { className: 'panel-header-title', textContent: 'TOP PRODUCING NATIONS' }),
      ),
      this.contentEl,
    );

    container.appendChild(this.el);

    // Initial render
    this.render(dashboardStore.getState().events);

    // Subscribe to events changes
    this.unsubscribe = subscribe(
      (s) => s.events,
      (events) => this.render(events),
    );
  }

  // -------------------------------------------------------------------------
  // Rebuild the table from current events
  // -------------------------------------------------------------------------

  private render(events: GasEvent[]): void {
    const rankings = getTopProducers(events, 15);
    const maxCount = rankings.length > 0 ? rankings[0].eventCount : 1;

    // Table header
    const thead = h('thead', null,
      h('tr', null,
        h('th', { textContent: '#', style: { width: '28px', textAlign: 'center' } }),
        h('th', { textContent: '', style: { width: '28px' } }),
        h('th', { textContent: 'Country' }),
        h('th', { textContent: 'Events (24h)', style: { textAlign: 'right' } }),
        h('th', { textContent: 'Avg Int.', style: { textAlign: 'right', width: '60px' } }),
        h('th', { textContent: 'Trend', style: { textAlign: 'center', width: '44px' } }),
      ),
    );

    // Table body rows
    const rows = rankings.map((nation, index) => {
      const barWidth = maxCount > 0
        ? Math.round((nation.eventCount / maxCount) * 100)
        : 0;

      const trendSymbol = nation.trend === 'up'
        ? '\u25B2'  // up triangle
        : nation.trend === 'down'
          ? '\u25BC'  // down triangle
          : '\u2013'; // en-dash for stable

      const trendColor = nation.trend === 'up'
        ? '#ff4444'
        : nation.trend === 'down'
          ? '#44aa44'
          : '#888888';

      return h('tr', null,
        h('td', {
          textContent: String(index + 1),
          style: { textAlign: 'center', color: '#888' },
        }),
        h('td', {
          textContent: flagEmoji(nation.countryCode),
          style: { textAlign: 'center', fontSize: '14px' },
        }),
        h('td', {
          textContent: nation.countryName,
          style: { color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' },
        }),
        h('td', {
          style: {
            textAlign: 'right',
            position: 'relative',
            color: '#00ff41',
            fontFamily: 'monospace',
          },
        },
          // Background bar
          h('div', {
            style: {
              position: 'absolute',
              top: '0',
              right: '0',
              bottom: '0',
              width: `${barWidth}%`,
              backgroundColor: 'rgba(0, 255, 65, 0.08)',
              pointerEvents: 'none',
            },
          }),
          h('span', {
            textContent: formatNumber(nation.eventCount),
            style: { position: 'relative', zIndex: '1' },
          }),
        ),
        h('td', {
          textContent: nation.avgIntensity.toFixed(1),
          style: { textAlign: 'right', fontFamily: 'monospace', color: '#aaa' },
        }),
        h('td', {
          textContent: trendSymbol,
          style: { textAlign: 'center', color: trendColor, fontWeight: 'bold' },
        }),
      );
    });

    const tbody = h('tbody', null, ...rows);

    const table = h('table', {
      className: 'data-table',
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '11px',
      },
    }, thead, tbody);

    replaceChildren(this.contentEl, table);
  }

  destroy(): void {
    this.unsubscribe();
  }
}
