import { useState } from 'react'

/**
 * Sci-fi HUD call-to-action button with hover glow + scale effect.
 * Replaces plain inline-styled buttons in the right panel.
 */
export default function CTAButton({
  onClick,
  icon,
  label,
  sublabel,
  shortcut,
  color = '#38f3ff',
  pulse = false,
  compact = false,
  active = false,
  children,
}) {
  const [hovered, setHovered] = useState(false)

  const baseGlow = `0 0 24px ${color}33, 0 0 48px ${color}14`
  const hoverGlow = `0 0 32px ${color}55, 0 0 64px ${color}22, 0 0 96px ${color}0d`
  const activeGlow = `0 0 16px ${color}33`

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: '0.15em',
        border: '1px solid',
        borderRadius: '6px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        width: '100%',
        padding: compact ? '14px 16px' : '24px 16px',
        fontSize: compact ? '12px' : '16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: active
          ? `${color}26`
          : hovered
            ? `${color}1a`
            : `${color}14`,
        borderColor: active || hovered ? color : `${color}aa`,
        color: active || hovered ? color : `${color}cc`,
        boxShadow: hovered ? hoverGlow : active ? activeGlow : baseGlow,
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        animation: pulse && !hovered ? 'pulseOpacity 2.5s ease-in-out infinite' : 'none',
      }}
    >
      {icon && <span style={{ fontSize: compact ? '20px' : '28px' }}>{icon}</span>}
      {label && <span>{label}</span>}
      {sublabel && (
        <span style={{
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: `${color}88`,
          fontWeight: 'normal',
        }}>
          {sublabel}
        </span>
      )}
      {shortcut && (
        <span style={{
          fontSize: '8px',
          color: `${color}55`,
          fontWeight: 'normal',
          letterSpacing: '0.05em',
        }}>
          Press {shortcut}
        </span>
      )}
      {children}
    </button>
  )
}
