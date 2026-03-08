import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

function timeSince(ts) {
  if (!ts) return 'No uploads yet'

  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return 'Uploaded just now'
  if (seconds < 3600) return `Uploaded ${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `Uploaded ${Math.floor(seconds / 3600)}h ago`
  return `Uploaded ${Math.floor(seconds / 86400)}d ago`
}

export default function FATWAExpressPanel({
  stats,
  latestEvent,
  activeModal,
  onOpenRecord,
  onOpenBrowse,
  onOpenTagLab,
  userSubmissionCount = 0,
}) {
  const cls = latestEvent
    ? classifyEmission(latestEvent.duration, latestEvent.volume)
    : null
  const flag = latestEvent ? (FLAG_MAP[latestEvent.country] || '🌍') : null

  return (
    <div className="fatwa-express">
      <div className="fatwa-express__header">
        <div>
          <div className="fatwa-express__eyebrow">Farts Around the World</div>
          <div className="fatwa-express__title">Mobile contribution lane</div>
        </div>
        <div className="fatwa-express__sync">
          <span className="fatwa-express__sync-dot" />
          <span>{timeSince(latestEvent?.timestamp)}</span>
        </div>
      </div>

      <div className="fatwa-express__stats">
        <div className="fatwa-express__stat">
          <span className="fatwa-express__stat-label">Today</span>
          <strong>{stats.totalToday}</strong>
        </div>
        <div className="fatwa-express__stat">
          <span className="fatwa-express__stat-label">All time</span>
          <strong>{stats.totalAllTime}</strong>
        </div>
        <div className="fatwa-express__stat">
          <span className="fatwa-express__stat-label">Regions</span>
          <strong>{stats.uniqueCountries || '—'}</strong>
        </div>
      </div>

      {/* Latest event classification badge */}
      {cls && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          margin: '0 0 8px',
          background: `${cls.color}08`,
          border: `1px solid ${cls.color}20`,
          borderRadius: '10px',
          fontFamily: 'monospace',
        }}>
          <span style={{ fontSize: '16px' }}>{flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 'bold', color: cls.color,
                letterSpacing: '0.06em',
              }}>
                {cls.label}
              </span>
              <span style={{
                fontSize: '7px', color: 'var(--text-dim)',
                padding: '1px 4px', borderRadius: '2px',
                background: 'rgba(56,243,255,0.06)',
                letterSpacing: '0.08em',
              }}>
                {cls.code}
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginTop: '2px',
            }}>
              <span style={{
                fontSize: '9px', color: 'var(--text-dim)',
              }}>
                {latestEvent.country}
              </span>
              {latestEvent.duration != null && (
                <span style={{ fontSize: '9px', color: '#38f3ff' }}>
                  {latestEvent.duration}s
                </span>
              )}
              {latestEvent.volume != null && (
                <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                  vol {latestEvent.volume}
                </span>
              )}
              {latestEvent.hasAudio && (
                <span style={{ fontSize: '10px', color: '#9dff4a' }}>♪</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Your submissions badge */}
      {userSubmissionCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '5px 12px',
          margin: '0 0 8px',
          background: 'rgba(157,255,74,0.06)',
          border: '1px solid rgba(157,255,74,0.15)',
          borderRadius: '8px',
          fontFamily: 'monospace',
        }}>
          <span style={{
            fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-dim)',
            textTransform: 'uppercase',
          }}>YOUR SUBMISSIONS</span>
          <span style={{
            fontSize: '14px', fontWeight: 'bold', color: '#9dff4a',
            textShadow: '0 0 8px rgba(157,255,74,0.4)',
          }}>{userSubmissionCount}</span>
        </div>
      )}

      <div className="fatwa-express__actions">
        <button
          className={`fatwa-express__button fatwa-express__button--record ${activeModal === 'record' ? 'is-active' : ''}`}
          onClick={onOpenRecord}
        >
          <span className="fatwa-express__button-icon">Record</span>
          <span className="fatwa-express__button-copy">Submit a new event with location data</span>
        </button>

        <button
          className={`fatwa-express__button fatwa-express__button--browse ${activeModal === 'browse' ? 'is-active' : ''}`}
          onClick={onOpenBrowse}
        >
          <span className="fatwa-express__button-icon">Browse</span>
          <span className="fatwa-express__button-copy">Review recordings and verify the dataset</span>
        </button>

        <button
          className={`fatwa-express__button fatwa-express__button--browse ${activeModal === 'tag-lab' ? 'is-active' : ''}`}
          onClick={onOpenTagLab}
        >
          <span className="fatwa-express__button-icon">Tag</span>
          <span className="fatwa-express__button-copy">Help classify patterns in the public archive</span>
        </button>
      </div>
    </div>
  )
}
