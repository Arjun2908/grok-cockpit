import { Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

class RootError extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.stack || error.message : String(error) }
  }

  render(): ReactNode {
    if (!this.state.message) return this.props.children
    return (
      <pre style={{ margin: 24, color: '#fecaca', whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
    )
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('missing root')
ReactDOM.createRoot(root).render(
  <RootError>
    <App />
  </RootError>
)
