import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/app.css'
import './styles/home.css'

// Accounts are optional. Without a Clerk key the app runs fine, just without sign-in.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const app = <App authEnabled={Boolean(clerkKey)} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clerkKey
      ? <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">{app}</ClerkProvider>
      : app}
  </React.StrictMode>
)
