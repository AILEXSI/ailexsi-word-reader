interface Props {
  message: string
  retryable?: boolean
  onRetry?: () => void
  onContinue?: () => void
  onDismiss: () => void
}

export function ErrorBanner({ message, retryable, onRetry, onContinue, onDismiss }: Props) {
  return (
    <div className="banner" role="alert">
      <p>{message}</p>
      <div className="banner-actions">
        {retryable && onRetry ? (
          <button type="button" className="btn-ghost" onClick={onRetry}>
            Erneut versuchen
          </button>
        ) : null}
        {onContinue ? (
          <button type="button" className="btn-ghost" onClick={onContinue}>
            Weiter ab hier
          </button>
        ) : null}
        <button type="button" className="btn-ghost" onClick={onDismiss}>
          Schließen
        </button>
      </div>
    </div>
  )
}
