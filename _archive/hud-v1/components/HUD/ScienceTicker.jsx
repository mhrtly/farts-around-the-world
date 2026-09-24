import { useState, useEffect, useRef, useCallback } from 'react'

const INTEL_BRIEFS = [
  { tag: 'DATA', text: 'Average human produces 0.5–1.5 liters of intestinal gas per day across 14–23 emission events.' },
  { tag: 'HEALTH', text: 'Only about 1% of flatus contains odor-causing compounds such as hydrogen sulfide, methanethiol, and dimethyl sulfide.' },
  { tag: 'SCIENCE', text: 'Nitrogen (20–90%), hydrogen (0–50%), and CO₂ (10–30%) make up most recorded intestinal gas volume.' },
  { tag: 'DIET', text: 'Dietary fiber intake correlates with emission volume. Populations with high-legume diets often show higher baseline readings.' },
  { tag: 'AUDIO', text: 'Sound frequency of emissions ranges 100–500 Hz. Pitch is shaped more by muscle tension and gas velocity than volume.' },
  { tag: 'SCIENCE', text: 'The gut microbiome contains roughly 100 trillion organisms across more than 1,000 species. Bacterial fermentation is the primary gas source.' },
  { tag: 'DATA', text: 'Methane is detected in only about 33% of the population. Methanogenic archaea such as M. smithii drive that variation.' },
  { tag: 'HEALTH', text: 'Post-meal emission latency is often 2–6 hours, while total transit time from ingestion to emission can range from 12–36 hours.' },
  { tag: 'SCIENCE', text: 'Altitude reduces atmospheric pressure, causing intestinal gas to expand by about 20% at cruising altitude.' },
  { tag: 'RESEARCH', text: 'Activated charcoal garments have been shown to reduce sulfide concentration by roughly 55–77% in controlled testing.' },
  { tag: 'HEALTH', text: 'Swallowed air contributes significantly to nitrogen content. Carbonated beverages can raise baseline readings.' },
  { tag: 'DIET', text: 'Cruciferous vegetables such as broccoli and cabbage contain raffinose, a sugar humans cannot digest without microbial help.' },
  { tag: 'CULTURE', text: 'Cultural norms around emissions vary widely. In some traditions, post-meal emissions can signal satisfaction to the host.' },
  { tag: 'CLIMATE', text: 'Bovine emissions contribute materially to greenhouse gases. A single cow can emit roughly 70–120 kg of methane per year.' },
  { tag: 'HEALTH', text: 'The Rome IV diagnostic criteria classify excessive flatulence under functional abdominal bloating and distension.' },
  { tag: 'SCIENCE', text: 'Lactose intolerance affects about 68% of the global population. Undigested lactose ferments in the colon and produces H₂ and CO₂.' },
  { tag: 'RESEARCH', text: 'Hydrogen breath tests can help detect bacterial overgrowth when exhaled H₂ rises more than 20 ppm above baseline.' },
  { tag: 'DIET', text: 'Beans contain oligosaccharides such as stachyose and verbascose that reach the colon intact. Alpha-galactosidase can help break them down.' },
  { tag: 'CLIMATE', text: 'Termites produce more methane than many industrial systems combined, making them a major emitter relative to body mass.' },
  { tag: 'RESEARCH', text: 'Gas chromatography-mass spectrometry can analyze rectal gas composition and assist in diagnosing malabsorption.' },
]

const TAG_COLORS = {
  DATA: '#38f3ff',
  HEALTH: '#9dff4a',
  SCIENCE: '#ffb020',
  DIET: '#ff64ff',
  AUDIO: '#ff4d5a',
  RESEARCH: '#38f3ff',
  CULTURE: '#ffb020',
  CLIMATE: '#ff64ff',
}

export default function ScienceTicker() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * INTEL_BRIEFS.length))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const intervalRef = useRef(null)

  const goNext = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setIndex(prev => (prev + 1) % INTEL_BRIEFS.length)
      setIsTransitioning(false)
    }, 300)
  }, [])

  const goPrev = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setIndex(prev => (prev - 1 + INTEL_BRIEFS.length) % INTEL_BRIEFS.length)
      setIsTransitioning(false)
    }, 300)
  }, [])

  useEffect(() => {
    if (isPaused || hovered) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(goNext, 12000)
    return () => clearInterval(intervalRef.current)
  }, [isPaused, hovered, goNext])

  const brief = INTEL_BRIEFS[index]
  const tagColor = TAG_COLORS[brief.tag] || '#38f3ff'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: 'monospace',
        borderTop: '1px solid rgba(56,243,255,0.06)',
        background: hovered ? 'rgba(6,9,13,0.8)' : 'rgba(6,9,13,0.6)',
        minHeight: '28px',
        transition: 'background 0.2s ease',
        userSelect: 'none',
      }}
    >
      {/* Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '7px',
          letterSpacing: '0.3em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}>
          FACT
        </span>
        <span style={{
          fontSize: '8px',
          letterSpacing: '0.15em',
          fontWeight: 'bold',
          color: tagColor,
          padding: '2px 7px',
          borderRadius: '2px',
          border: `1px solid ${tagColor}55`,
          background: `${tagColor}12`,
          boxShadow: `0 0 6px ${tagColor}15`,
          transition: 'all 0.35s ease',
        }}>
          {brief.tag}
        </span>
      </div>

      {/* Navigation arrows — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); goPrev() }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(56,243,255,0.4)',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '10px',
          lineHeight: 1,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.2s ease, color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#38f3ff'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(56,243,255,0.4)'}
        title="Previous fact"
      >
        ◀
      </button>

      {/* Scrolling text */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        fontSize: '9px',
        color: hovered ? 'var(--text-primary)' : 'var(--text-dim)',
        letterSpacing: '0.04em',
        lineHeight: 1.3,
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease, color 0.2s ease',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {brief.text}
      </div>

      {/* Next arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); goNext() }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(56,243,255,0.4)',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '10px',
          lineHeight: 1,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.2s ease, color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#38f3ff'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(56,243,255,0.4)'}
        title="Next fact"
      >
        ▶
      </button>

      {/* Pause indicator — visible on hover */}
      {hovered && (
        <span style={{
          fontSize: '7px',
          letterSpacing: '0.15em',
          color: 'rgba(255,176,32,0.5)',
          flexShrink: 0,
          animation: 'fadeIn 0.2s ease',
        }}>
          PAUSED
        </span>
      )}

      {/* Counter pill + progress */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <div style={{
          width: '24px', height: '3px',
          borderRadius: '1.5px',
          background: 'rgba(56,243,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${((index + 1) / INTEL_BRIEFS.length) * 100}%`,
            height: '100%',
            background: `${tagColor}55`,
            borderRadius: '1.5px',
            transition: 'width 0.4s ease, background 0.4s ease',
          }} />
        </div>
        <span style={{
          fontSize: '7px',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.05em',
        }}>
          {index + 1}/{INTEL_BRIEFS.length}
        </span>
      </div>
    </div>
  )
}
