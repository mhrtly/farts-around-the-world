// Recordings posted from this browser, with the token that lets you delete them.

const KEY = 'fatw:mine:v1'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // private mode / storage blocked — ownership just won't persist
  }
}

export function rememberOwnRecording(id, deleteToken) {
  const data = read()
  data[id] = { token: deleteToken || null, postedAt: Date.now() }
  write(data)
}

export function forgetOwnRecording(id) {
  const data = read()
  delete data[id]
  write(data)
}

export function ownRecordingToken(id) {
  return read()[id]?.token || null
}

export function isOwnRecording(id) {
  return Boolean(read()[id])
}

export function ownRecordingIds() {
  return new Set(Object.keys(read()))
}
