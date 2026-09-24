import { Component } from 'react'

// Last line of defense: if something throws while rendering, show a friendly
// way out instead of a black screen.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Farts Around the World] crashed:', error, info?.componentStack)
    window.dispatchEvent(new Event('fatw:ready')) // make sure the splash gets out of the way
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <div className="crash__mark" aria-hidden="true">💨</div>
        <h1 className="crash__title">Well, that stinks.</h1>
        <p className="crash__body">Something broke while loading the map. A reload usually clears the air.</p>
        <button type="button" className="crash__button" onClick={() => window.location.assign('/')}>
          Reload
        </button>
      </div>
    )
  }
}
