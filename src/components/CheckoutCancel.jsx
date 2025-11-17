import React, { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import './CheckoutCancel.css'

const CheckoutCancel = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    // 🔍 DEBUG: Log checkout cancellation
    console.log('❌ [ABANDONED CART] Checkout was cancelled:', {
      sessionId: sessionId || 'unknown',
      timestamp: new Date().toISOString(),
      message: 'Session will be marked as abandoned after 30 minutes if not completed'
    })
    console.log('📊 [ABANDONED CART] Check customer portal dashboard to see abandoned cart tracking')
  }, [sessionId])

  return (
    <div className="checkout-cancel-page">
      <div className="container">
        <motion.div
          className="cancel-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="cancel-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="cancel-title">Payment Cancelled</h1>
          <p className="cancel-message">
            Your payment was cancelled. No charges have been made.
          </p>
          <div className="cancel-actions">
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

export default CheckoutCancel

