import { memo } from 'react'

// The paper slip a finished take prints: what it measured, when, and where.
// Pure presentation; the recorder builds `slip` (see slipFor in RecorderSheet)
// and the same markup flies to the globe when it's posted.

const BLANK = ' '

function TakeSlip({ slip, inkKey }) {
  const { name, take, dateLine, trace, rows, loc, stamp } = slip
  return (
    <article className="slip" aria-label="Take slip">
      <header className="slip__head">
        <h3 className="slip__name">{name}</h3>
        {take > 1 && <span className="slip__take">TAKE {take}</span>}
      </header>
      {dateLine && <p className="slip__date">{dateLine}</p>}
      {trace && (
        <div className="slip__trace" aria-hidden="true">
          {trace.map((value, index) => <span key={index} style={{ height: `${Math.max(8, value * 100).toFixed(1)}%` }} />)}
        </div>
      )}
      <div className="slip__rule" />
      <dl className="slip__rows">
        {rows.map(row => (
          <div key={row.label} className="slip__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="slip__rule" />
      {loc.status === 'ready' ? (
        <div key={inkKey || 'printed'} className={`slip__where ${inkKey ? 'is-inking' : ''}`}>
          <p className="slip__place">{loc.place}</p>
          <p className="slip__coords">{loc.coords}</p>
          <p className="slip__coords">{loc.note}</p>
        </div>
      ) : (
        <div className="slip__where">
          <p className={`slip__place ${loc.status === 'locating' ? 'is-blinking' : ''}`}>{loc.line1}</p>
          <p className="slip__coords">{loc.line2 || BLANK}</p>
          <p className="slip__coords">{BLANK}</p>
        </div>
      )}
      {stamp && (
        <div className="slip__stamp" aria-label={stamp.n ? `Posted, number ${stamp.n}` : 'Posted'}>
          <span>POSTED</span>
          {stamp.n ? <strong>NO. {stamp.n}</strong> : null}
        </div>
      )}
      <p className="slip__fine" aria-hidden="true">100% organic · Potato Propaganda</p>
    </article>
  )
}

export default memo(TakeSlip)
