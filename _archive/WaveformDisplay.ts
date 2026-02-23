// ---------------------------------------------------------------------------
// ACOUSTIC SENSOR ARRAY - LIVE
// Purely decorative oscilloscope-style waveform display. Renders a continuous
// green waveform on black canvas using requestAnimationFrame. The waveform
// shows a base sine oscillation with random noise, and amplitude spikes
// briefly when new gas events arrive in the store.
// ---------------------------------------------------------------------------

import { h } from '../utils/dom.ts';
import { subscribe } from '../store/dashboardStore.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 200;
const WAVEFORM_COLOR = '#00ff41';
const WAVEFORM_GLOW = 'rgba(0, 255, 65, 0.3)';
const BACKGROUND_COLOR = '#000000';
const DISPLAY_HEIGHT = 120;
const BASE_AMPLITUDE = 0.15;
const SPIKE_AMPLITUDE = 0.7;
const SPIKE_DECAY_FRAMES = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class WaveformDisplay {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;
  private unsubscribe: () => void;
  private rafId: number | null = null;

  /** Circular buffer of amplitude values (0..1 range). */
  private buffer: Float32Array;
  /** Remaining spike frames. Counts down to 0. */
  private spikeFrames = 0;
  /** Frame counter for sine oscillation. */
  private frameCount = 0;

  constructor(container: HTMLElement) {
    this.buffer = new Float32Array(BUFFER_SIZE);

    this.canvas = document.createElement('canvas');
    this.canvas.height = DISPLAY_HEIGHT;
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${DISPLAY_HEIGHT}px`;
    this.canvas.style.display = 'block';
    this.canvas.style.backgroundColor = BACKGROUND_COLOR;

    this.ctx = this.canvas.getContext('2d')!;

    this.contentEl = h('div', { className: 'panel-content' }, this.canvas);

    this.el = h('div', { className: 'panel' },
      h('div', { className: 'panel-header' },
        h('span', { className: 'panel-header-title', textContent: 'ACOUSTIC SENSOR ARRAY - LIVE' }),
      ),
      this.contentEl,
    );

    container.appendChild(this.el);

    // Resize canvas to match container width
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.contentEl);

    // Subscribe to events to detect new arrivals for amplitude spikes
    this.unsubscribe = subscribe(
      (s) => s.events.length,
      (count, prevCount) => {
        if (count > prevCount) {
          this.spikeFrames = SPIKE_DECAY_FRAMES;
        }
      },
    );

    // Start the animation loop
    this.animate();
  }

  // -------------------------------------------------------------------------
  // Resize handler
  // -------------------------------------------------------------------------

  private handleResize(): void {
    const rect = this.contentEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(DISPLAY_HEIGHT * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Animation loop
  // -------------------------------------------------------------------------

  private animate = (): void => {
    this.frameCount++;

    // Calculate current amplitude target
    let amplitude = BASE_AMPLITUDE;
    if (this.spikeFrames > 0) {
      // Decay the spike linearly over SPIKE_DECAY_FRAMES
      const spikeFactor = this.spikeFrames / SPIKE_DECAY_FRAMES;
      amplitude = BASE_AMPLITUDE + (SPIKE_AMPLITUDE - BASE_AMPLITUDE) * spikeFactor;
      this.spikeFrames--;
    }

    // Generate new waveform value:
    //  - Base sine wave at varying frequencies for organic feel
    //  - Random noise for texture
    const t = this.frameCount * 0.08;
    const sine = Math.sin(t) * 0.6
      + Math.sin(t * 2.3) * 0.25
      + Math.sin(t * 0.7) * 0.15;
    const noise = (Math.random() - 0.5) * 0.3;
    const value = (sine + noise) * amplitude;

    // Shift buffer left, add new value at end
    this.buffer.copyWithin(0, 1);
    this.buffer[BUFFER_SIZE - 1] = value;

    this.draw();

    this.rafId = requestAnimationFrame(this.animate);
  };

  // -------------------------------------------------------------------------
  // Draw the waveform
  // -------------------------------------------------------------------------

  private draw(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = DISPLAY_HEIGHT;

    if (width <= 0) return;

    const ctx = this.ctx;
    const centerY = height / 2;

    // Clear to black
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Draw center line (dimmed)
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw waveform glow (thicker, faded line underneath)
    ctx.strokeStyle = WAVEFORM_GLOW;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < BUFFER_SIZE; i++) {
      const x = (i / (BUFFER_SIZE - 1)) * width;
      const y = centerY + this.buffer[i] * (height * 0.4);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw waveform main line
    ctx.strokeStyle = WAVEFORM_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < BUFFER_SIZE; i++) {
      const x = (i / (BUFFER_SIZE - 1)) * width;
      const y = centerY + this.buffer[i] * (height * 0.4);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw scanline effect (subtle horizontal lines)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unsubscribe();
    this.resizeObserver.disconnect();
  }
}
