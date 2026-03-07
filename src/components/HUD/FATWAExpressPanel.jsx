function timeSince(ts) {
  if (!ts) return 'No uploads yet'

  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return 'Uploaded just now'
  if (seconds < 3600) return `Uploaded ${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `Uploaded ${Math.floor(seconds / 3600)}h ago`
  return `Uploaded ${Math.floor(seconds / 86400)}d ago`
}

function formatCountry(code) {
  if (!code) return 'Unknown region'
  return code.toUpperCase()
}

export default function FATWAExpressPanel({
  stats,
  latestEvent,
  activeModal,
  onOpenRecord,
  onOpenBrowse,
}) {
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
          <strong>{formatCountry(latestEvent?.country)}</strong>
        </div>
      </div>

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
