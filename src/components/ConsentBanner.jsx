import React from 'react'
import './ConsentBanner.css'
import { hasAnalyticsConsent, hasDismissedConsent, setAnalyticsConsent, markConsentDismissed } from '../services/geo'

const ConsentBanner = ({ onAccept }) => {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const consentGiven = hasAnalyticsConsent()
    const dismissed = hasDismissedConsent()
    if (!consentGiven && !dismissed) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    setAnalyticsConsent(true)
    setVisible(false)
    if (onAccept) {
      onAccept()
    }
  }

  const handleDecline = () => {
    markConsentDismissed()
    setVisible(false)
  }

  if (!visible) {
    return null
  }

  return (
    <div className="consent-banner">
      <div className="consent-content">
        <p>
          We use cookies and analytics to improve your experience. By accepting, you agree to geo tracking for analytics purposes.
        </p>
        <div className="consent-actions">
          <button className="primary" onClick={handleAccept}>
            Accept
          </button>
          <button className="secondary" onClick={handleDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConsentBanner
