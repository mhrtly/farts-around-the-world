import { Show, SignInButton, UserButton } from '@clerk/react'
import Icon from './Icon.jsx'

// Only rendered when Clerk is configured (VITE_CLERK_PUBLISHABLE_KEY).
// Accounts are optional: nobody needs to sign in to record or listen.

export function AccountAvatar() {
  return (
    <Show when="signed-in">
      <UserButton appearance={{ elements: { avatarBox: { width: '30px', height: '30px' } } }} />
    </Show>
  )
}

export function AccountMenuItem() {
  return (
    <Show when="signed-out">
      <div className="menu__divider" />
      <SignInButton mode="modal">
        <button type="button" role="menuitem">
          <Icon name="link" size={18} />
          <span><strong>Sign in</strong><em>Optional — not needed to record</em></span>
        </button>
      </SignInButton>
    </Show>
  )
}
