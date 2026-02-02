import React from 'react'

type ErrorBoundaryState = {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Ключевой лог: по нему мы поймём, какой компонент ломается в проде
    console.error('Global ErrorBoundary caught error:', error, '\nComponent stack:\n', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#fff' }}>
          <h1>Что-то пошло не так</h1>
          <p>Команда уже получает подробный лог ошибки (смотри консоль браузера).</p>
        </div>
      )
    }
    return this.props.children
  }
}


