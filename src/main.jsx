import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/tokens.css'
import './styles/app.css'
import './styles/base.css'
import './styles/globe.css'
import './styles/topbar.css'
import './styles/sheet.css'
import './styles/list.css'
import './styles/player.css'
import './styles/card.css'
import './styles/dock.css'
import './styles/recorder.css'
import './styles/about.css'
import './styles/toasts.css'

// Accounts are optional. Without a Clerk key the app runs fine, just without sign-in.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const app = <App authEnabled={Boolean(clerkKey)} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {clerkKey
        ? <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">{app}</ClerkProvider>
        : app}
    </ErrorBoundary>
  </React.StrictMode>
)
