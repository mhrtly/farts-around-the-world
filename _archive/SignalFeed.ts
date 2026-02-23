// ---------------------------------------------------------------------------
// SIGNAL INTELLIGENCE FEED
// The key war room panel. Displays a scrolling real-time feed of signal
// intelligence intercepts formatted in NATO-style flash traffic format.
// New entries prepend at top with CSS animation. Left border is color-coded
// by signal priority. Auto-scrolls to top unless the user has scrolled down.
// ---------------------------------------------------------------------------

import type { SignalIntercept, SignalPriority } from '../types/index.ts';
import { h } from '../utils/dom.ts';
import { formatTimestamp, formatCoordinates, formatClassification } from '../utils/format.ts';
import { dashboardStore, subscribe } from '../store/dashboardStore.ts';

// ---------------------------------------------------------------------------
// Priority -> left border color mapping
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<SignalPriority, string> = {
  FLASH: '#ff4444',
  IMMEDIATE: '#ff8800',
  PRIORITY: '#ffaa00',
  ROUTINE: '#44aa44',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class SignalFeed {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private userScrolled = false;
  private unsubscribe: () => void;
  private renderedIds = new Set<string>();

  constructor(container: HTMLElement) {
    this.contentEl = h('div', {
      className: 'panel-content',
      style: {
        overflowY: 'auto',
        maxHeight: '400px',
      },
    });

    this.el = h('div', { className: 'panel' },
      h('div', { className: 'panel-header' },
        h('span', { className: 'panel-header-title', textContent: 'SIGNAL INTELLIGENCE FEED' }),
      ),
      this.contentEl,
    );

    container.appendChild(this.el);

    // Track whether the user has scrolled away from the top
    this.contentEl.addEventListener('scroll', () => {
      this.userScrolled = this.contentEl.scrollTop > 30;
    });

    // Initial render with current signals
    const initialSignals = dashboardStore.getState().recentSignals;
    for (const signal of [...initialSignals].reverse()) {
      this.prependEntry(signal, false);
    }

    // Subscribe to new signals
    this.unsubscribe = subscribe(
      (s) => s.recentSignals,
      (signals, prevSignals) => {
        // Find new signals that were not in the previous array
        const prevIds = new Set(prevSignals.map((s) => s.id));
        const newSignals = signals.filter((s) => !prevIds.has(s.id));
        for (const signal of newSignals) {
          this.prependEntry(signal, true);
        }
      },
    );
  }

  // -------------------------------------------------------------------------
  // Build and prepend a single signal entry
  // -------------------------------------------------------------------------

  private prependEntry(signal: SignalIntercept, animate: boolean): void {
    if (this.renderedIds.has(signal.id)) return;
    this.renderedIds.add(signal.id);

    const borderColor = PRIORITY_COLORS[signal.priority] ?? '#44aa44';
    const ts = formatTimestamp(signal.timestamp);
    const coords = formatCoordinates(signal.originCoordinates[0], signal.originCoordinates[1]);
    const refId = signal.relatedEventId.slice(0, 8).toUpperCase();

    // Find the classification from the related event if available
    const state = dashboardStore.getState();
    const relatedEvent = state.events.find((e) => e.id === signal.relatedEventId);
    const classification = relatedEvent
      ? formatClassification(relatedEvent.classification)
      : 'UNCLASSIFIED';
    const intensity = relatedEvent ? relatedEvent.intensity : 0;

    // Build formatted body text
    const bodyText = [
      `SUBJ: Gas Event - ${signal.originCity}, ${signal.originCountry}`,
      `COORD: ${coords}`,
      `CLASS: ${classification} | INT: ${intensity}/10`,
      signal.summary,
      `REF: GE-${refId} | STATUS: ACTIVE`,
    ].join('\n');

    const headerLine = `[${signal.priority}] ${ts} | ${signal.type} | ${signal.classification}`;

    const entryEl = h('div', {
      className: animate ? 'signal-entry new' : 'signal-entry',
      style: {
        borderLeft: `3px solid ${borderColor}`,
        padding: '8px 10px',
        marginBottom: '6px',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: '1.5',
      },
    },
      h('div', { className: 'signal-priority', style: { color: borderColor, fontWeight: 'bold' } },
        h('span', { textContent: `[${signal.priority}]` }),
      ),
      h('div', { className: 'signal-header', style: { color: '#00ff41', whiteSpace: 'pre' } },
        h('span', { textContent: headerLine }),
      ),
      h('div', { className: 'signal-body', style: { color: '#aaa', whiteSpace: 'pre-wrap', marginTop: '4px' } },
        h('span', { textContent: bodyText }),
      ),
    );

    // Prepend at top
    if (this.contentEl.firstChild) {
      this.contentEl.insertBefore(entryEl, this.contentEl.firstChild);
    } else {
      this.contentEl.appendChild(entryEl);
    }

    // Auto-scroll to top unless user has scrolled down
    if (!this.userScrolled) {
      this.contentEl.scrollTop = 0;
    }

    // Limit total rendered entries to avoid unbounded DOM growth
    const maxEntries = 50;
    while (this.contentEl.children.length > maxEntries) {
      const last = this.contentEl.lastChild as HTMLElement | null;
      if (last) {
        this.contentEl.removeChild(last);
      }
    }
  }

  destroy(): void {
    this.unsubscribe();
  }
}
