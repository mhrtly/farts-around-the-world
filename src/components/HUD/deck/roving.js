// Arrow keys inside a strip of preset keys: move to the neighbour (Home/End
// to the ends) and press it. The strip is one tab stop. The event stops here,
// so the app's own ←/→ (newer/older fart) doesn't fire as well.
const MOVES = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }

export function rovingKeyDown(event, onPick) {
  const move = MOVES[event.key]
  if (move == null || event.metaKey || event.ctrlKey || event.altKey) return
  const keys = [...event.currentTarget.querySelectorAll('button')]
  const from = keys.indexOf(document.activeElement)
  if (from < 0) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat) return // one step per press: each one starts playing
  const to = Math.max(0, Math.min(keys.length - 1, from + move))
  if (to === from) return
  keys[to].focus()
  onPick(to)
}
