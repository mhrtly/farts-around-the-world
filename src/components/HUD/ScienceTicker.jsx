import { useState, useEffect, useRef } from 'react'

// Real digestive science facts presented in OSINT briefing style
const INTEL_BRIEFS = [
  { tag: 'SIGINT', text: 'Average human produces 0.5–1.5 liters of intestinal gas per day across 14–23 emission events.' },
  { tag: 'ANALYSIS', text: 'Only 1% of flatus contains odorous compounds. Primary olfactory agents: hydrogen sulfide, methanethiol, dimethyl sulfide.' },
  { tag: 'HUMINT', text: 'Nitrogen (20–90%), hydrogen (0–50%), and CO₂ (10–30%) constitute the non-odorous majority of emissions.' },
  { tag: 'GEOINT', text: 'Dietary fiber intake correlates with emission volume. Populations with high-legume diets show elevated baseline readings.' },
  { tag: 'TECHINT', text: 'Sound frequency of emissions ranges 100–500 Hz. Pitch determined by sphincter tension and gas velocity, not volume.' },
  { tag: 'ANALYSIS', text: 'Gut microbiome contains ~100 trillion organisms across 1,000+ species. Bacterial fermentation is the primary gas source.' },
  { tag: 'SIGINT', text: 'Methane detected in only 33% of population. Methanogenic archaea (M. smithii) responsible. Trait partially genetic.' },
  { tag: 'HUMINT', text: 'Post-meal emission latency: 2–6 hours typical. Transit time from ingestion to emission varies 12–36 hours.' },
  { tag: 'GEOINT', text: 'Altitude reduces atmospheric pressure, causing intestinal gas to expand ~20% at cruising altitude (35,000 ft).' },
  { tag: 'TECHINT', text: 'Activated charcoal underwear reduces sulfide concentration by 55–77%. Field-tested by NASA for space missions.' },
  { tag: 'ANALYSIS', text: 'Swallowed air (aerophagia) accounts for significant nitrogen content. Carbonated beverages increase baseline readings by 30%.' },
  { tag: 'SIGINT', text: 'Cruciferous vegetables (broccoli, cabbage) contain raffinose — a trisaccharide humans cannot digest. Microbes can.' },
  { tag: 'HUMINT', text: 'Cultural emission norms vary significantly. In some cultures, post-meal emissions signal satisfaction to the host.' },
  { tag: 'GEOINT', text: 'Bovine emissions contribute ~14.5% of global greenhouse gases. Single cow: 70–120 kg methane/year.' },
  { tag: 'TECHINT', text: 'The Rome IV diagnostic criteria classify excessive flatulence as functional abdominal bloating/distension (H3).' },
  { tag: 'ANALYSIS', text: 'Lactose intolerance affects ~68% of world population. Undigested lactose ferments in colon, producing H₂ and CO₂.' },
  { tag: 'SIGINT', text: 'Hydrogen breath tests detect bacterial overgrowth. Exhaled H₂ > 20 ppm above baseline indicates fermentation.' },
  { tag: 'HUMINT', text: 'Beans contain oligosaccharides (stachyose, verbascose) that reach the colon intact. Alpha-galactosidase enzyme (Beano) helps.' },
  { tag: 'GEOINT', text: 'Termites produce more methane than all industrial sources combined. Nature\'s most prolific emitters per body mass.' },
  { tag: 'TECHINT', text: 'Rectal gas composition analyzable via gas chromatography-mass spectrometry. Clinical tool for diagnosing malabsorption.' },
]

const TAG_COLORS = {
  SIGINT: '#38f3ff',
  ANALYSIS: '#9dff4a',
  HUMINT: '#ffb020',
  GEOINT: '#ff64ff',
  TECHINT: '#ff4d5a',
}

export default function ScienceTicker() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * INTEL_BRIEFS.length))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % INTEL_BRIEFS.length)
        setIsTransitioning(false)
      }, 400)
    }, 12000)

    return () => clearInterval(intervalRef.current)
  }, [])

  const brief = INTEL_BRIEFS[index]
  const tagColor = TAG_COLORS[brief.tag] || '#38f3ff'

  return (
    <div style={{
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'monospace',
      borderTop: '1px solid rgba(56,243,255,0.06)',
      background: 'rgba(6,9,13,0.6)',
      minHeight: '28px',
    }}>
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
          INTEL
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

      {/* Scrolling text */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        fontSize: '9px',
        color: 'var(--text-dim)',
        letterSpacing: '0.04em',
        lineHeight: 1.3,
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {brief.text}
      </div>

      {/* Counter pill */}
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
