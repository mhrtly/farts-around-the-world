import { useState, useMemo, useCallback } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

const MILESTONES = [1, 3, 5, 10, 25, 50]

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}

/**
 * Shows the user's own submission stats for the current session.
 * Tracks: submission count, countries covered, classifications,
 * total duration, average volume, and recent submissions list.
 */
export default function MyContributions({ submissions, totalGlobalEvents }) {
  const [expanded, setExpanded] = useState(false)

  const stats = useMemo(() => {
    if (!submissions || submissions.length === 0) return null

    const countries = new Set(submissions.map(s => s.country).filter(Boolean))
    const classifications = {}
    let totalDuration = 0
    let totalVolume = 0
    let volCount = 0

    for (const s of submissions) {
      const cls = classifyEmission(s.duration, s.volume)
      classifications[cls.label] = (classifications[cls.label] || 0) + 1
      if (s.duration) totalDuration += s.duration
      if (s.volume) { totalVolume += s.volume; volCount++ }
    }

    // Find dominant classification
    const topClass = Object.entries(classifications)
      .sort(([, a], [, b]) => b - a)[0]

    // Next milestone
    const nextMilestone = MILESTONES.find(m => m > submissions.length) || null

    // Global contribution percentage
    const globalPct = totalGlobalEvents > 0
      ? ((submissions.length / totalGlobalEvents) * 100).toFixed(1)
      : '0'

    return {
      count: submissions.length,
      countries: [...countries],
      topClassification: topClass ? topClass[0] : null,
      topClassCount: topClass ? topClass[1] : 0,
      avgDuration: submissions.length > 0 ? (totalDuration / submissions.length).toFixed(1) : '0',
      avgVolume: volCount > 0 ? (totalVolume / volCount).toFixed(1) : '0',
      nextMilestone,
      globalPct,
    }
  }, [submissions, totalGlobalEvents])

  if (!stats) {
    return (
      <div style={{
        padding: '12px',
        background: 'rgba(10,18,28,0.5)',
        border: '1px solid rgba(157,255,74,0.08)',
        borderRadius: '6px',
        fontFamily: 'monospace',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '8px', letterSpacing: '0.25em', color: 'var(--text-dim)',
          textTransform: 'uppercase', marginBottom: '8px',
        }}>
          YOUR CONTRIBUTIONS
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(157,255,74,0.4)', marginBottom: '4px' }}>
          No submissions yet
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
          Press <span style={{ color: 'rgba(255,107,107,0.6)' }}>R</span> to record your first emission
        </div>
      </div>
    )
  }

  const progressToNext = stats.nextMilestone
    ? (stats.count / stats.nextMilestone) * 100
    : 100

  return (
    <div style={{
      background: 'rgba(10,18,28,0.5)',
      border: '1px solid rgba(157,255,74,0.12)',
      borderRadius: '6px',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(prev => !prev)}
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid rgba(157,255,74,0.08)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '8px', letterSpacing: '0.25em', color: 'var(--text-dim)',
            textTransform: 'uppercase',
          }}>
            YOUR CONTRIBUTIONS
          </span>
          <span style={{
            fontSize: '12px', fontWeight: 'bold', color: '#9dff4a',
            textShadow: '0 0 8px rgba(157,255,74,0.4)',
          }}>
            {stats.count}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Global contribution */}
          <span style={{
            fontSize: '8px', color: 'rgba(56,243,255,0.5)', letterSpacing: '0.05em',
          }}>
            {stats.globalPct}% of global
          </span>
          <span style={{
            fontSize: '8px', color: 'rgba(157,255,74,0.3)',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            lineHeight: 1,
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Milestone progress bar */}
      {stats.nextMilestone && (
        <div style={{ padding: '0 12px', paddingTop: expanded ? '0' : '0', paddingBottom: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{
              flex: 1, height: '3px', borderRadius: '1.5px',
              background: 'rgba(157,255,74,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressToNext}%`,
                height: '100%',
                borderRadius: '1.5px',
                background: 'linear-gradient(90deg, rgba(157,255,74,0.4), #9dff4a)',
                boxShadow: '0 0 4px rgba(157,255,74,0.3)',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{
              fontSize: '7px', color: 'rgba(157,255,74,0.4)', letterSpacing: '0.05em',
              flexShrink: 0,
            }}>
              {stats.count}/{stats.nextMilestone}
            </span>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{
          padding: '8px 12px 12px',
          animation: 'fadeIn 0.15s ease',
        }}>
          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px', marginBottom: '10px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: '2px' }}>
                AVG DURATION
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38f3ff' }}>
                {stats.avgDuration}s
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: '2px' }}>
                AVG VOLUME
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38f3ff' }}>
                {stats.avgVolume}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: '2px' }}>
                COUNTRIES
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff64ff' }}>
                {stats.countries.length}
              </div>
            </div>
          </div>

          {/* Countries covered */}
          {stats.countries.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {stats.countries.map(code => (
                <span key={code} style={{
                  fontSize: '12px',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  background: 'rgba(157,255,74,0.08)',
                  border: '1px solid rgba(157,255,74,0.15)',
                }}>
                  {FLAG_MAP[code] || '🌍'}
                </span>
              ))}
            </div>
          )}

          {/* Dominant classification */}
          {stats.topClassification && (
            <div style={{
              fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '8px',
            }}>
              <span>Dominant type:</span>
              <span style={{
                color: '#ffb020', fontWeight: 'bold', letterSpacing: '0.1em',
              }}>
                {stats.topClassification.toUpperCase()}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>
                ({stats.topClassCount}x)
              </span>
            </div>
          )}

          {/* Recent submissions */}
          <div style={{
            fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)',
            textTransform: 'uppercase', marginBottom: '4px',
          }}>
            RECENT SUBMISSIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {submissions.slice(0, 5).map((s, i) => {
              const cls = classifyEmission(s.duration, s.volume)
              return (
                <div key={s.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '9px', padding: '3px 6px',
                  background: 'rgba(6,9,13,0.4)',
                  borderRadius: '3px',
                  border: `1px solid ${cls.color}15`,
                }}>
                  <span style={{ fontSize: '11px' }}>{FLAG_MAP[s.country] || '🌍'}</span>
                  <span style={{ color: cls.color, fontWeight: 'bold', letterSpacing: '0.08em', flex: 1 }}>
                    {cls.label.toUpperCase()}
                  </span>
                  {s.duration != null && (
                    <span style={{ color: 'var(--text-dim)' }}>{s.duration}s</span>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '8px' }}>
                    {relativeTime(s.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
