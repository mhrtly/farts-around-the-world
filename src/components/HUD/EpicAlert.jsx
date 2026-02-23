import React, { useEffect } from 'react'

const COUNTRY_NAMES = {
  US:'UNITED STATES', GB:'UNITED KINGDOM', DE:'GERMANY', FR:'FRANCE',
  JP:'JAPAN', CN:'CHINA', BR:'BRAZIL', IN:'INDIA', AU:'AUSTRALIA',
  CA:'CANADA', MX:'MEXICO', RU:'RUSSIA', NG:'NIGERIA', ZA:'SOUTH AFRICA',
  EG:'EGYPT', AR:'ARGENTINA', KR:'SOUTH KOREA', ID:'INDONESIA',
  TR:'TURKEY', IT:'ITALY',
}

const CONFIG = {
  epic:               { label: '⚡ EPIC FART DETECTED',    color: '#ff64ff', glow: 'rgba(255,100,255,0.35)' },
  'silent-but-deadly':{ label: '💀 SILENT BUT DEADLY',     color: '#9dff4a', glow: 'rgba(157,255,74,0.35)'  },
}

export default function EpicAlert({ event, onDismiss }) {
  useEffect(() => {
    if (!event) return
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [event, onDismiss])

  if (!event) return null

  const cfg = CONFIG[event.type] ?? CONFIG.epic
  const country = COUNTRY_NAMES[event.country] ?? event.country

  return (
    <div
      className="epic-alert"
      style={{ '--alert-color': cfg.color, '--alert-glow': cfg.glow }}
      onClick={onDismiss}
    >
      <div className="epic-alert__stripes" />
      <div className="epic-alert__inner">
        <span className="epic-alert__label">{cfg.label}</span>
        <span className="epic-alert__detail">
          {country}
          <span className="epic-alert__sep">·</span>
          {event.lat.toFixed(2)}°, {event.lng.toFixed(2)}°
          <span className="epic-alert__sep">·</span>
          INTENSITY {event.intensity} / 10
        </span>
      </div>
      <div className="epic-alert__bar" />
    </div>
  )
}
