// Where is this page running? Shared links often open inside social apps'
// built-in browsers, which usually can't use the microphone.

const IN_APP = [
  ['Instagram', /Instagram/i],
  ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS/i],
  ['Messenger', /Messenger|MessengerForiOS/i],
  ['TikTok', /musical_ly|BytedanceWebview|TikTok/i],
  ['Snapchat', /Snapchat/i],
  ['LinkedIn', /LinkedInApp/i],
  ['LINE', /\bLine\//],
  ['WeChat', /MicroMessenger/i],
  ['Threads', /Barcelona/i],
]

export function inAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  for (const [name, pattern] of IN_APP) if (pattern.test(ua)) return name
  // Generic Android WebView
  if (/; wv\)/.test(ua)) return 'this app'
  return null
}

// Every browser on iOS (and Safari on the Mac) is Apple WebKit underneath.
export function isAppleWebKit() {
  if (typeof navigator === 'undefined') return false
  return navigator.vendor === 'Apple Computer, Inc.' || /iPhone|iPad|iPod/.test(navigator.userAgent)
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
