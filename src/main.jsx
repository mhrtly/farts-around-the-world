import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/tokens.css'
import './styles/app.css'
import './styles/base.css'
import './styles/instrument.css'
import './styles/globe.css'
import './styles/zoom.css'
import './styles/topbar.css'
import './styles/sheet.css'
import './styles/list.css'
import './styles/player.css'
import './styles/card.css'
import './styles/dock.css'
import './styles/recorder.css'
import './styles/about.css'
import './styles/toasts.css'

// For whoever opens the console
if (typeof console !== 'undefined') {
  console.log(
    '%c   .-~~~-.\n  /  o   o \\\n |    ~     |\n  \\  o    /\n   `~---~`%c\n\nFarts Around the World\nA Potato Propaganda production.\nThe map knows a word. Try typing it.',
    'color:#c9a26b;font-family:monospace;line-height:1.15',
    'color:#62f6d0;font-family:monospace',
  )
}

// Accounts are optional. Without a Clerk key the app runs fine, just without
// sign-in; with one, Clerk loads lazily from the menu (see AccountControls).
const authEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App authEnabled={authEnabled} />
    </ErrorBoundary>
  </React.StrictMode>
)
