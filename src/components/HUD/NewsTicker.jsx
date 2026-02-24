import React from 'react'

const TICKER_MESSAGES = [
  'BREAKING: Unusual methane cluster detected over Northern Finland — authorities monitoring situation',
  'FLASH TRAFFIC: Embassy staff evacuated in Rome following sustained emission event — diplomatic incident assessment pending',
  'SIGINT INTERCEPT: Munich bratwurst festival correlated with 340% EPM surge — GASCON upgraded to CRITICAL',
  'ADVISORY: Suspicious fart gap detected across Scandinavia — The Council is concerned',
  'ANALYST BRIEF: Pattern analysis suggests coordinated bean consumption across Southern Europe — motive unknown',
  'WEATHER: Prevailing winds carrying methane plume from Buenos Aires toward Montevideo — downwind alert issued',
  'INTELLIGENCE UPDATE: Subject denied culpability — acoustic analysis refutes — DECEPTION rating: HIGH',
  'BULLETIN: All-source assessment indicates tikka masala consumed at 1900 hours local — causation: ESTABLISHED',
  'OPERATIONAL NOTE: Third emission event from grid square BR-7 in 90 minutes — designating confirmed hotspot',
  'SIGINT: Thermal bloom detected on satellite pass — intensity rated UNPRECEDENTED — analysts standing by',
  'FLASH: Conference room sealed for 47 minutes following SBD event — no survivors olfactorily — recovery ongoing',
  'ADVISORY: High sulfur payload with dairy origin confirmed — OLFACTORY-ARRAY-7 sensor saturation imminent',
  'DISPATCH: Asset BEANSTALK reports escalating situation in Northern Sector — recommend immediate monitoring upgrade',
  'STRATEGIC BRIEF: Global bowel activity trending 18% above seasonal baseline — root cause investigation ongoing',
  'INTELLIGENCE: Source attempted blame-shift to adjacent canine — physiological indicators confirm human origin with HIGH confidence',
]

// Double the content for seamless loop
const SEPARATOR = '   \u25c6   '
const FULL_TEXT = TICKER_MESSAGES.join(SEPARATOR) + SEPARATOR

export default function NewsTicker() {
  return (
    <div className="news-ticker">
      <div className="ticker-badge">BREAKING</div>
      <div className="ticker-track">
        <span className="ticker-content">
          {FULL_TEXT}{FULL_TEXT}
        </span>
      </div>
    </div>
  )
}
