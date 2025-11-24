import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import Products from './components/Products'
import ProductDetail from './components/ProductDetail'
import Experience from './components/Experience'
import About from './components/About'
import BookNow from './components/BookNow'
import JoinUs from './components/JoinUs'
import Contact from './components/Contact'
import CheckoutSuccess from './components/CheckoutSuccess'
import CheckoutCancel from './components/CheckoutCancel'
import Footer from './components/Footer'
import Cart from './components/Cart'
import { CartProvider } from './context/CartContext'
import { trackEvent } from './services/api'
import ConsentBanner from './components/ConsentBanner'
import { hasAnalyticsConsent, trackGeoPageView } from './services/geo'
import './App.css'

// Component to track page views
const PageTracker = ({ analyticsConsent }) => {
  const location = useLocation()

  useEffect(() => {
    // Track page view on route change
    trackEvent('page_view', {
      page: location.pathname,
      referrer: document.referrer
    })
  }, [location])

  useEffect(() => {
    if (analyticsConsent) {
      trackGeoPageView()
    }
  }, [analyticsConsent, location])

  return null
}

function App() {
  const [analyticsConsent, setAnalyticsConsent] = useState(false)

  useEffect(() => {
    if (hasAnalyticsConsent()) {
      setAnalyticsConsent(true)
    }
  }, [])

  const handleConsentAccepted = async () => {
    setAnalyticsConsent(true)
    await trackGeoPageView()
  }

  return (
    <CartProvider>
      <Router>
        <div className="App">
          <PageTracker analyticsConsent={analyticsConsent} />
          <Navigation />
          <Cart />
          <ConsentBanner onAccept={handleConsentAccepted} />
          <Routes>
            <Route path="/" element={
              <>
                <Hero />
                <Products />
                <Experience />
              </>
            } />
            <Route path="/shop" element={<Products />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/book" element={<BookNow />} />
            <Route path="/about" element={<About />} />
            <Route path="/join" element={<JoinUs />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </CartProvider>
  )
}

export default App

