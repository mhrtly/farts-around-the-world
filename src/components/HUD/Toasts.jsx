import Icon from './Icon.jsx'

// Small stack of notices at the top of the screen ("New fart from Paris").
export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast--${toast.tone || 'info'}`}>
          {toast.action ? (
            <button type="button" className="toast__body" onClick={() => { toast.action(); onDismiss(toast.id) }}>
              {toast.icon && <span className="toast__icon" aria-hidden="true">{toast.icon}</span>}
              <span className="toast__text">{toast.text}</span>
              {toast.actionLabel && <span className="toast__action">{toast.actionLabel}</span>}
            </button>
          ) : (
            <div className="toast__body">
              {toast.icon && <span className="toast__icon" aria-hidden="true">{toast.icon}</span>}
              <span className="toast__text">{toast.text}</span>
            </div>
          )}
          <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
