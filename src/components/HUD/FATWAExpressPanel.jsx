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
}) {
  const cls = latestEvent
    ? classifyEmission(latestEvent.duration, latestEvent.volume)
    : null
  const flag = latestEvent ? (FLAG_MAP[latestEvent.country] || '🌍') : null

  return (
    <div className="fatwa-express">
      <div className="fatwa-express__header">
        <div>
          <div className="fatwa-express__eyebrow">FATWA Express</div>
          <div className="fatwa-express__title">Mobile upload lane</div>
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
          <span className="fatwa-express__stat-label">Latest</span>
          <strong>
            {flag && <span style={{ marginRight: '4px' }}>{flag}</span>}
            {latestEvent?.country?.toUpperCase() || '—'}
          </strong>
        </div>
      </div>

      {/* Latest event classification badge */}
      {cls && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          margin: '0 12px',
          background: `${cls.color}08`,
          border: `1px solid ${cls.color}20`,
          borderRadius: '4px',
          fontFamily: 'monospace',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: 'bold', color: cls.color,
          }}>
            {cls.label}
          </span>
          <span style={{
            fontSize: '8px', color: 'var(--text-dim)',
            padding: '1px 4px', borderRadius: '2px',
            background: 'rgba(56,243,255,0.06)',
          }}>
            {cls.code}
          </span>
          {latestEvent.duration != null && (
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
              {latestEvent.duration}s
            </span>
          )}
          {latestEvent.hasAudio && (
            <span style={{ fontSize: '10px', color: '#9dff4a' }}>♪</span>
          )}
        </div>
      )}

      <div className="fatwa-express__actions">
        <button
          className={`fatwa-express__button fatwa-express__button--record ${activeModal === 'record' ? 'is-active' : ''}`}
          onClick={onOpenRecord}
        >
          <span className="fatwa-express__button-icon">Record</span>
          <span className="fatwa-express__button-copy">Capture and upload with geotagging</span>
        </button>

        <button
          className={`fatwa-express__button fatwa-express__button--browse ${activeModal === 'browse' ? 'is-active' : ''}`}
          onClick={onOpenBrowse}
        >
          <span className="fatwa-express__button-icon">Browse</span>
          <span className="fatwa-express__button-copy">Play back and verify persisted recordings</span>
        </button>
      </div>
    </div>
  )
}
