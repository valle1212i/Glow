import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { trackEvent } from '../services/api'
import './CheckoutSuccess.css'

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      // 🔍 DEBUG: Log successful checkout completion
      console.log('✅ [ABANDONED CART] Checkout completed successfully:', {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        message: 'Session will be marked as completed in customer portal (not abandoned)'
      })
      console.log('📊 [ABANDONED CART] This session will NOT be counted as abandoned cart')
      
      // Send payment tracking event to customer portal
      sendPaymentTracking(sessionId)
    } else {
      setLoading(false)
    }
  }, [sessionId])

  const sendPaymentTracking = async (sessionId) => {
    try {
      // Note: The webhook handler should send full payment details automatically
      // This is a fallback in case the webhook doesn't fire
      // The webhook handler is the primary method for sending payment data
      
      console.log('📤 Sending fallback payment tracking for session:', sessionId)
      
      await trackEvent('customer_payment', {
        sessionId: sessionId,
        status: 'completed',
        timestamp: new Date().toISOString()
      })

      console.log('✅ Fallback payment tracking sent to customer portal')
    } catch (error) {
      console.error('❌ Error sending payment tracking:', error)
      // Don't show error to user - webhook should handle it
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="checkout-success-page">
      <div className="container">
        <motion.div
          className="success-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="success-title">Payment Successful!</h1>
          <p className="success-message">
            Thank you for your purchase. Your order has been confirmed.
          </p>
          {sessionId && (
            <p className="success-session">
              Order ID: {sessionId.substring(0, 20)}...
            </p>
          )}
          <div className="success-actions">
            <Link to="/shop" className="continue-shopping-btn">
              Continue Shopping
            </Link>
            <Link to="/" className="back-home-btn">
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default CheckoutSuccess

