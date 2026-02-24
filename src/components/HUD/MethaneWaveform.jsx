import React, { useEffect, useRef, useMemo } from 'react'

const HISTORY = 120  // samples kept

const PEAK_LABELS = [
  'CARBONARA INCIDENT',
  'BEAN SURGE',
  'DAIRY EVENT',
  'BURRITO CLUSTER',
  'POST-LUNCH SPIKE',
  'SUSPICIOUS UPLIFT',
  'CURRY CORRELATION',
]

export default function MethaneWaveform({ events }) {
  const canvasRef = useRef(null)
  const samplesRef = useRef(new Array(HISTORY).fill(0))
  const rafRef = useRef(null)
  const phaseRef = useRef(0)

  // Drive amplitude from recent events
  const recentCount = useMemo(() => {
    const now = Date.now()
    return events.filter(e => now - e.timestamp < 3000).length
  }, [events])

  useEffect(() => {
    const amp = Math.min(recentCount / 8, 1)
    samplesRef.current = [...samplesRef.current.slice(1), amp]
  }, [recentCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // DPI-aware sizing
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const W = rect.width  || 236
    const H = rect.height || 56
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    function draw() {
      ctx.clearRect(0, 0, W, H)

      const samples = samplesRef.current
      phaseRef.current += 0.04

      // Grid lines
      ctx.strokeStyle = 'rgba(56,243,255,0.04)'
      ctx.lineWidth = 0.5
      for (let y = H * 0.25; y < H; y += H * 0.25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      for (let x = W * 0.25; x < W; x += W * 0.25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }

      // Baseline
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.strokeStyle = 'rgba(56,243,255,0.1)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Compute y with idle baseline so it's always animated
      const getY = (i) => {
        const driven = samples[i]
        const idle = 0.07
        const eff = Math.max(driven, idle)
        const wave = eff * (
          Math.sin((i / HISTORY) * Math.PI * 8 + phaseRef.current) * 0.6 +
          Math.sin((i / HISTORY) * Math.PI * 3 + phaseRef.current * 0.7) * 0.4
        )
        return H / 2 - wave * (H * 0.42)
      }

      // Waveform fill
      ctx.beginPath()
      for (let i = 0; i < HISTORY; i++) {
        const x = (i / (HISTORY - 1)) * W
        i === 0 ? ctx.moveTo(x, getY(i)) : ctx.lineTo(x, getY(i))
      }
      ctx.lineTo(W, H / 2); ctx.lineTo(0, H / 2); ctx.closePath()
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H)
      fillGrad.addColorStop(0, 'rgba(56,243,255,0.14)')
      fillGrad.addColorStop(1, 'rgba(56,243,255,0)')
      ctx.fillStyle = fillGrad
      ctx.fill()

      // Waveform line
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0,    'rgba(56,243,255,0)')
      grad.addColorStop(0.12, 'rgba(56,243,255,0.85)')
      grad.addColorStop(0.88, 'rgba(56,243,255,0.85)')
      grad.addColorStop(1,    'rgba(56,243,255,0)')

      ctx.beginPath()
      for (let i = 0; i < HISTORY; i++) {
        const x = (i / (HISTORY - 1)) * W
        i === 0 ? ctx.moveTo(x, getY(i)) : ctx.lineTo(x, getY(i))
      }
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.shadowColor = 'rgba(56,243,255,0.8)'
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0

      // Peak annotations — up to 2 labels on high-amplitude samples
      ctx.font = '9px "Courier New", monospace'
      let labelCount = 0
      for (let i = 4; i < HISTORY - 4 && labelCount < 2; i++) {
        const val = samples[i]
        if (val > 0.6) {
          // Check it's a local peak (higher than neighbors)
          if (val >= samples[i - 3] && val >= samples[i + 3]) {
            const alpha = Math.min((val - 0.6) / 0.35, 1)
            const x = (i / (HISTORY - 1)) * W
            const y = getY(i) - 6
            const label = PEAK_LABELS[i % PEAK_LABELS.length]

            ctx.save()
            ctx.globalAlpha = alpha * 0.9
            ctx.fillStyle = 'rgba(56,243,255,0.9)'
            ctx.shadowColor = 'rgba(56,243,255,0.8)'
            ctx.shadowBlur = 6
            ctx.fillText(label, Math.min(x, W - ctx.measureText(label).width - 2), Math.max(y, 10))
            ctx.restore()
            labelCount++
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="waveform-panel">
      <div className="panel-title">METHANE SIGNATURE</div>
      <canvas ref={canvasRef} className="waveform-canvas" />
      <div className="waveform-footer">
        <span className="waveform-label">CH₄</span>
        <span className="waveform-label">LIVE TELEMETRY</span>
        <span className="waveform-label" style={{ color: '#9dff4a' }}>3s WINDOW</span>
      </div>
    </div>
  )
}
