import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import TopBanner from './components/TopBanner'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import Products from './components/Products'
import ProductDetail from './components/ProductDetail'
import Experience from './components/Experience'
import About from './components/About'
import BookNow from './components/BookNow'
import JoinUs from './components/JoinUs'
import Contact from './components/Contact'
import Footer from './components/Footer'
import Cart from './components/Cart'
import { CartProvider } from './context/CartContext'
import { trackEvent } from './services/api'
import './App.css'

// Component to track page views
const PageTracker = () => {
  const location = useLocation()

  useEffect(() => {
    // Track page view on route change
    trackEvent('page_view', {
      page: location.pathname,
      referrer: document.referrer
    })
  }, [location])

  return null
}

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="App">
          <PageTracker />
          <TopBanner />
          <Navigation />
          <Cart />
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
          </Routes>
          <Footer />
        </div>
      </Router>
    </CartProvider>
  )
}

export default App

