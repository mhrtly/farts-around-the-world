import { useState, useEffect, useRef } from 'react'
import { playMilestoneChime } from '../../utils/notificationSound.js'

const COUNTRY_NAMES = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  JP: 'Japan', CN: 'China', BR: 'Brazil', IN: 'India', AU: 'Australia',
  CA: 'Canada', MX: 'Mexico', RU: 'Russia', NG: 'Nigeria', ZA: 'South Africa',
  EG: 'Egypt', AR: 'Argentina', KR: 'South Korea', ID: 'Indonesia',
  TR: 'Turkey', IT: 'Italy',
}

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

const MILESTONE_COUNTS = [10, 25, 50, 100, 250, 500, 1000]

function MilestoneToastItem({ milestone, onDone, index }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onDone, 400)
    }, 6000)

    return () => clearTimeout(timer)
  }, [onDone])

  const colors = {
    'new-country': { bg: '#ff64ff', icon: '🌍' },
    'milestone-count': { bg: '#ffb020', icon: '🏆' },
    'daily-record': { bg: '#9dff4a', icon: '📈' },
    'coverage': { bg: '#38f3ff', icon: '🛰️' },
  }

  const config = colors[milestone.type] || colors['milestone-count']

  return (
    <div style={{
      position: 'absolute',
      top: `${index * 64 + 12}px`,
      left: '50%',
      transform: visible && !exiting
        ? 'translateX(-50%) translateY(0) scale(1)'
        : exiting
          ? 'translateX(-50%) translateY(-20px) scale(0.95)'
          : 'translateX(-50%) translateY(20px) scale(0.95)',
      opacity: visible && !exiting ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 20px',
      background: 'rgba(10,18,28,0.95)',
      border: `1px solid ${config.bg}44`,
      borderRadius: '8px',
      fontFamily: 'monospace',
      backdropFilter: 'blur(12px)',
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${config.bg}22`,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 8000 - index,
    }}>
      <span style={{ fontSize: '24px' }}>{config.icon}</span>
      <div>
        <div style={{
          fontSize: '7px',
          letterSpacing: '0.25em',
          color: config.bg,
          fontWeight: 'bold',
          marginBottom: '2px',
        }}>
          MILESTONE
        </div>
        <div style={{
          fontSize: '11px',
          color: '#fff',
          fontWeight: 'bold',
          letterSpacing: '0.05em',
        }}>
          {milestone.message}
        </div>
        {milestone.sub && (
          <div style={{
            fontSize: '8px',
            color: 'var(--text-dim)',
            letterSpacing: '0.08em',
            marginTop: '2px',
          }}>
            {milestone.sub}
          </div>
        )}
      </div>
    </div>
  )
}

const PERSONAL_MILESTONES = [1, 3, 5, 10, 25, 50]

/**
 * Detects and displays milestone achievements:
 * - First emission from a new country
 * - Total event count milestones (10, 25, 50, 100, etc.)
 * - Coverage milestones (25%, 50%, 75%, 100% of nations)
 * - Personal submission milestones (1, 3, 5, 10, 25, 50)
 */
export default function MilestoneToast({ events, userSubmissions = [] }) {
  const [milestones, setMilestones] = useState([])
  const trackedRef = useRef({
    countries: new Set(),
    countMilestones: new Set(),
    coverageMilestones: new Set(),
    personalMilestones: new Set(),
    initialized: false,
  })

  useEffect(() => {
    const tracked = trackedRef.current

    // Don't initialize until we have actual events loaded
    // This prevents the [] → [loaded events] transition from firing milestones
    if (!tracked.initialized) {
      if (events.length === 0) return // Wait for data

      // First time we see events — record everything as baseline
      for (const e of events) {
        if (e.country) tracked.countries.add(e.country.toUpperCase())
      }
      // Mark existing count milestones as seen
      for (const m of MILESTONE_COUNTS) {
        if (events.length >= m) tracked.countMilestones.add(m)
      }
      // Mark existing coverage milestones
      const pct = Math.floor((tracked.countries.size / 20) * 100)
      for (const threshold of [25, 50, 75, 100]) {
        if (pct >= threshold) tracked.coverageMilestones.add(threshold)
      }
      tracked.initialized = true
      return
    }

    const newMilestones = []

    // Check for new countries
    for (const e of events) {
      if (!e.country) continue
      const code = e.country.toUpperCase()
      if (!tracked.countries.has(code)) {
        tracked.countries.add(code)
        const flag = FLAG_MAP[code] || '🌍'
        const name = COUNTRY_NAMES[code] || code
        newMilestones.push({
          id: `country-${code}-${Date.now()}`,
          type: 'new-country',
          message: `${flag} First signal from ${name}!`,
          sub: `${tracked.countries.size}/20 nations reporting`,
        })
      }
    }

    // Check for count milestones
    for (const m of MILESTONE_COUNTS) {
      if (events.length >= m && !tracked.countMilestones.has(m)) {
        tracked.countMilestones.add(m)
        newMilestones.push({
          id: `count-${m}-${Date.now()}`,
          type: 'milestone-count',
          message: `${m} emissions recorded!`,
          sub: 'Global dataset expanding',
        })
      }
    }

    // Check for coverage milestones
    const coveragePct = Math.floor((tracked.countries.size / 20) * 100)
    for (const threshold of [25, 50, 75, 100]) {
      if (coveragePct >= threshold && !tracked.coverageMilestones.has(threshold)) {
        tracked.coverageMilestones.add(threshold)
        const messages = {
          25: '25% global coverage reached',
          50: 'Half the world reporting!',
          75: '75% coverage — closing in',
          100: '★ FULL GLOBAL COVERAGE ★',
        }
        newMilestones.push({
          id: `coverage-${threshold}-${Date.now()}`,
          type: 'coverage',
          message: messages[threshold],
          sub: `${tracked.countries.size}/20 nations active`,
        })
      }
    }

    if (newMilestones.length > 0) {
      setMilestones(prev => [...prev, ...newMilestones].slice(-3))
      playMilestoneChime()
    }
  }, [events])

  // Personal submission milestones
  useEffect(() => {
    if (userSubmissions.length === 0) return
    const tracked = trackedRef.current
    const personalMilestones = []

    for (const m of PERSONAL_MILESTONES) {
      if (userSubmissions.length >= m && !tracked.personalMilestones.has(m)) {
        tracked.personalMilestones.add(m)
        const messages = {
          1: 'First emission submitted!',
          3: '3 submissions — building momentum!',
          5: '5 submissions — prolific contributor!',
          10: '10 submissions — elite field agent!',
          25: '25 submissions — SIGINT specialist!',
          50: '50 submissions — legendary operator!',
        }
        personalMilestones.push({
          id: `personal-${m}-${Date.now()}`,
          type: 'daily-record',
          message: messages[m] || `${m} personal submissions!`,
          sub: 'Your contribution to global intelligence',
        })
      }
    }

    if (personalMilestones.length > 0) {
      setMilestones(prev => [...prev, ...personalMilestones].slice(-3))
      playMilestoneChime()
    }
  }, [userSubmissions])

  const removeMilestone = (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  if (milestones.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      left: 0,
      right: 0,
      zIndex: 8000,
      pointerEvents: 'none',
    }}>
      {milestones.map((m, i) => (
        <MilestoneToastItem
          key={m.id}
          milestone={m}
          index={i}
          onDone={() => removeMilestone(m.id)}
        />
      ))}
    </div>
  )
}
