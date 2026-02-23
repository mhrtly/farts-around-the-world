// ---------------------------------------------------------------------------
// GLOBAL EMISSIONS TIMELINE
// Canvas-based line chart showing gas events over time (default: last 24h).
// Pure Canvas 2D rendering - no D3 dependency. Green line (#00ff41) on dark
// background with area fill, grid lines, and responsive width.
// Events are bucketed into 15-minute intervals via MetricsCalculator.
// ---------------------------------------------------------------------------

import type { GasEvent, TimeSeriesPoint } from '../types/index.ts';
import { h } from '../utils/dom.ts';
import { getTimeSeries } from '../services/MetricsCalculator.ts';
import { dashboardStore, subscribe } from '../store/dashboardStore.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_MS = 15 * 60 * 1000; // 15 minutes
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const LINE_COLOR = '#00ff41';
const FILL_COLOR = 'rgba(0, 255, 65, 0.1)';
const GRID_COLOR = '#1a1a1a';
const AXIS_COLOR = '#333333';
const LABEL_COLOR = '#555555';
const CHART_HEIGHT = 160;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class EmissionsChart {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;
  private unsubscribe: () => void;
  private series: TimeSeriesPoint[] = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.height = CHART_HEIGHT;
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${CHART_HEIGHT}px`;
    this.canvas.style.display = 'block';

    this.ctx = this.canvas.getContext('2d')!;

    this.contentEl = h('div', { className: 'panel-content' }, this.canvas);

    this.el = h('div', { className: 'panel' },
      h('div', { className: 'panel-header' },
        h('span', { className: 'panel-header-title', textContent: 'GLOBAL EMISSIONS TIMELINE' }),
      ),
      this.contentEl,
    );

    container.appendChild(this.el);

    // Resize canvas to match container width
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.contentEl);

    // Initial render
    this.update(dashboardStore.getState().events);

    // Subscribe to events
    this.unsubscribe = subscribe(
      (s) => s.events,
      (events) => this.update(events),
    );
  }

  // -------------------------------------------------------------------------
  // Resize handler - sync canvas internal resolution with CSS size
  // -------------------------------------------------------------------------

  private handleResize(): void {
    const rect = this.contentEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(CHART_HEIGHT * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  // -------------------------------------------------------------------------
  // Update data from store
  // -------------------------------------------------------------------------

  private update(events: GasEvent[]): void {
    // Filter to last 24 hours
    const now = Date.now();
    const cutoff = now - TWENTY_FOUR_HOURS_MS;
    const filtered = events.filter((e) => e.timestamp >= cutoff);

    this.series = getTimeSeries(filtered, BUCKET_MS);
    this.draw();
  }

  // -------------------------------------------------------------------------
  // Canvas drawing
  // -------------------------------------------------------------------------

  private draw(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = CHART_HEIGHT;

    if (width <= 0) return;

    const ctx = this.ctx;
    const padding = { top: 16, right: 12, bottom: 28, left: 36 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // If no data, show placeholder
    if (this.series.length === 0) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING DATA...', width / 2, height / 2);
      return;
    }

    // Compute scales
    const maxCount = Math.max(1, ...this.series.map((p) => p.eventCount));
    const minTs = this.series[0].timestamp;
    const maxTs = this.series[this.series.length - 1].timestamp;
    const tsRange = maxTs - minTs || 1;

    const xScale = (ts: number): number =>
      padding.left + ((ts - minTs) / tsRange) * chartW;
    const yScale = (count: number): number =>
      padding.top + chartH - (count / maxCount) * chartH;

    // Draw horizontal grid lines (5 lines)
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    // Draw vertical grid lines (every ~3 hours for 24h view)
    const verticalCount = 8;
    for (let i = 0; i <= verticalCount; i++) {
      const ts = minTs + (tsRange / verticalCount) * i;
      const x = xScale(ts);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(xScale(this.series[0].timestamp), yScale(0));
    for (const point of this.series) {
      ctx.lineTo(xScale(point.timestamp), yScale(point.eventCount));
    }
    ctx.lineTo(xScale(this.series[this.series.length - 1].timestamp), yScale(0));
    ctx.closePath();
    ctx.fillStyle = FILL_COLOR;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(xScale(this.series[0].timestamp), yScale(this.series[0].eventCount));
    for (let i = 1; i < this.series.length; i++) {
      ctx.lineTo(xScale(this.series[i].timestamp), yScale(this.series[i].eventCount));
    }
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw small dots at each data point
    ctx.fillStyle = LINE_COLOR;
    for (const point of this.series) {
      const x = xScale(point.timestamp);
      const y = yScale(point.eventCount);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // X-axis labels (time)
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= verticalCount; i++) {
      const ts = minTs + (tsRange / verticalCount) * i;
      const x = xScale(ts);
      const date = new Date(ts);
      const label = `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
      ctx.fillText(label, x, padding.top + chartH + 14);
    }

    // Y-axis labels (count)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const count = Math.round((maxCount / 4) * (4 - i));
      const y = padding.top + (chartH / 4) * i;
      ctx.fillText(String(count), padding.left - 4, y + 3);
    }
  }

  destroy(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
  }
}
