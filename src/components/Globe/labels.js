// Place names and counts printed beside the markers, in a DOM layer over the
// canvas (crisp text at any pixel ratio, real fonts). Placed greedily by
// priority (the open fart's marker first, then the busiest) and skipped
// wherever one would cover a dot or another label, so a crowded view thins
// out instead of piling up.

const PAD_X = 5
const LINE_H = 13

export class LabelLayer {
  // root: an empty element laid over the canvas
  constructor(root) {
    this.root = root
    this.pool = new Map() // key → { el, name, count, text, n, tone }
    this.widths = new Map()
    this.canvas = document.createElement('canvas').getContext('2d')
  }

  // Width of a label's text in px (measured once per string with the label
  // font; B612 is wide, so a guess would crowd or waste space)
  measure(text) {
    const key = text
    let width = this.widths.get(key)
    if (width == null) {
      this.canvas.font = `700 10px B612, system-ui, sans-serif`
      const spacing = text.length * 10 * 0.14
      width = this.canvas.measureText(text.toUpperCase()).width + spacing
      if (document.fonts?.status === 'loaded') this.widths.set(key, width)
    }
    return width
  }

  // labels: [{ key, x, y, r (dot radius px), name, count, priority,
  //            above (centre over the point, e.g. a bloom's pin), tone }]
  // dots: [{ x, y, r }] — every drawn marker, to keep labels off them
  // covers: [{ x0, y0, x1, y1 }] — panels over the globe (no label under them)
  update(labels, dots, width, height, covers = []) {
    const placed = []
    const boxes = dots.map(d => ({ x0: d.x - d.r - 1, y0: d.y - d.r - 1, x1: d.x + d.r + 1, y1: d.y + d.r + 1, dot: d })).concat(covers)
    const collides = box => {
      if (box.x0 < 4 || box.y0 < 4 || box.x1 > width - 4 || box.y1 > height - 4) return true
      for (const other of boxes) {
        if (other.dot && other.dot.key === box.key) continue
        if (box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0) return true
      }
      return false
    }
    const sorted = [...labels].sort((a, b) => b.priority - a.priority)
    for (const full of sorted) {
      // A cluster whose name doesn't fit still gets its count
      const options = full.name && full.count ? [full, { ...full, name: null }] : [full]
      const fit = options.map(label => this.fit(label, collides)).find(Boolean)
      if (!fit) continue
      boxes.push(fit.box)
      placed.push(fit)
    }
    this.render(placed)
  }

  // Beside the dot (right, else left), or centred above it for a bloom
  fit(label, collides) {
    const nameW = label.name ? this.measure(label.name) : 0
    const countW = label.count ? this.measure(String(label.count)) + (label.name ? 6 : 0) : 0
    const w = nameW + countW + 2
    if (label.above) {
      const x0 = label.x - w / 2
      const y1 = label.y - label.r - 4
      const box = { x0, y0: y1 - LINE_H, x1: x0 + w, y1, key: label.key }
      if (!collides(box)) return { label, box }
    }
    const right = { x0: label.x + label.r + PAD_X, y0: label.y - LINE_H / 2, x1: label.x + label.r + PAD_X + w, y1: label.y + LINE_H / 2, key: label.key }
    if (!collides(right)) return { label, box: right }
    const left = { x0: label.x - label.r - PAD_X - w, y0: right.y0, x1: label.x - label.r - PAD_X, y1: right.y1, key: label.key }
    if (!collides(left)) return { label, box: left }
    return null
  }

  // DOM: reuse elements by key; new ones fade in (CSS), gone ones go
  render(placed) {
    const live = new Set()
    for (const { label, box } of placed) {
      live.add(label.key)
      let entry = this.pool.get(label.key)
      if (!entry) {
        const el = document.createElement('span')
        el.className = 'globe-label'
        const name = document.createElement('span')
        name.className = 'globe-label__name'
        const count = document.createElement('span')
        count.className = 'globe-label__count'
        el.append(name, count)
        this.root.appendChild(el)
        entry = { el, name, count, text: null, n: null, tone: null }
        this.pool.set(label.key, entry)
      }
      if (entry.text !== (label.name || '')) {
        entry.text = label.name || ''
        entry.name.textContent = entry.text
      }
      const n = label.count ? String(label.count) : ''
      if (entry.n !== n) {
        entry.n = n
        entry.count.textContent = n
      }
      const tone = label.tone || ''
      if (entry.tone !== tone) {
        entry.tone = tone
        entry.el.dataset.tone = tone
      }
      entry.el.style.transform = `translate3d(${Math.round(box.x0)}px, ${Math.round(box.y0)}px, 0)`
    }
    for (const [key, entry] of this.pool) {
      if (live.has(key)) continue
      entry.el.remove()
      this.pool.delete(key)
    }
  }

  clear() {
    for (const entry of this.pool.values()) entry.el.remove()
    this.pool.clear()
  }

  dispose() {
    this.clear()
  }
}
