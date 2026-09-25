import { useEffect } from 'react'
import { ClerkProvider, useClerk, useUser } from '@clerk/react'

// Accounts are optional: nobody needs to sign in to record or listen. Clerk is
// loaded lazily (only after someone opens the menu, or already has a session),
// so its scripts never slow down the first visit. This host renders nothing;
// it reports the account state up so the menu can show plain menu items.

function Bridge({ onChange }) {
  const clerk = useClerk()
  const { isLoaded, isSignedIn, user } = useUser()
  useEffect(() => {
    if (!isLoaded) {
      onChange({ status: 'loading' })
      return
    }
    const name = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || null
    onChange({
      status: isSignedIn ? 'signedIn' : 'signedOut',
      name,
      openSignIn: () => clerk.openSignIn(),
      openProfile: () => clerk.openUserProfile(),
      signOut: () => clerk.signOut(),
    })
  }, [clerk, isLoaded, isSignedIn, user, onChange])
  return null
}

// Clerk's sign-in dialog in the app's own type (it would otherwise inherit the
// page's old monospace base font)
const APPEARANCE = { variables: { fontFamily: "'B612', system-ui, sans-serif", colorPrimary: '#1c1a16' } }

export default function AccountHost({ publishableKey, onChange }) {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" appearance={APPEARANCE}>
      <Bridge onChange={onChange} />
    </ClerkProvider>
  )
}
