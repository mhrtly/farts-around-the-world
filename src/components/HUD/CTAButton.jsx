import { useState, useCallback } from 'react'

/**
 * Sci-fi HUD call-to-action button with hover glow, scale, icon animation,
 * and click feedback ripple effect.
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
  const [clicked, setClicked] = useState(false)

  const handleClick = useCallback((e) => {
    setClicked(true)
    setTimeout(() => setClicked(false), 300)
    onClick?.(e)
  }, [onClick])

  const baseGlow = `0 0 24px ${color}33, 0 0 48px ${color}14`
  const hoverGlow = `0 0 32px ${color}55, 0 0 64px ${color}22, 0 0 96px ${color}0d`
  const activeGlow = `0 0 16px ${color}33`
  const clickGlow = `0 0 40px ${color}66, 0 0 80px ${color}33`

  return (
    <button
      onClick={handleClick}
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
        fontSize: compact ? '12px' : '17px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
        overflow: 'hidden',
        background: active
          ? `${color}26`
          : clicked
            ? `${color}22`
            : hovered
              ? `${color}1a`
              : `${color}14`,
        borderColor: active || hovered ? color : `${color}aa`,
        color: active || hovered ? color : `${color}cc`,
        boxShadow: clicked ? clickGlow : hovered ? hoverGlow : active ? activeGlow : baseGlow,
        transform: clicked
          ? 'scale(0.97)'
          : hovered
            ? 'scale(1.02)'
            : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        animation: pulse && !hovered ? 'pulseOpacity 2.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        top: 0, left: '10%', right: '10%',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}${hovered ? '88' : '33'}, transparent)`,
        transition: 'all 0.2s ease',
      }} />

      {icon && (
        <span style={{
          fontSize: compact ? '20px' : '28px',
          transform: hovered ? 'scale(1.15) translateY(-2px)' : 'scale(1) translateY(0)',
          transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          filter: hovered ? `drop-shadow(0 2px 8px ${color}55)` : 'none',
        }}>
          {icon}
        </span>
      )}
      {label && (
        <span style={{ lineHeight: 1.2 }}>
          {label}
        </span>
      )}
      {sublabel && (
        <span style={{
          fontSize: '11px',
          lineHeight: 1.55,
          letterSpacing: '0.08em',
          color: `${color}88`,
          fontWeight: 'normal',
        }}>
          {sublabel}
        </span>
      )}
      {shortcut && (
        <span style={{
          fontSize: '8px',
          color: hovered ? `${color}88` : `${color}55`,
          fontWeight: 'normal',
          letterSpacing: '0.05em',
          padding: '1px 6px',
          borderRadius: '2px',
          background: hovered ? `${color}10` : 'transparent',
          border: `1px solid ${hovered ? `${color}22` : 'transparent'}`,
          transition: 'all 0.2s ease',
        }}>
          Press {shortcut}
        </span>
      )}
      {children}
    </button>
  )
}
