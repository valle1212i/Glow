import React, { useState } from 'react'
import { motion } from 'framer-motion'
import './JoinUs.css'

const JoinUs = () => {
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const packages = [
    {
      id: 'basic',
      name: 'Basic',
      price: 899, // SEK per month
      period: 'per month',
      productId: 'prod_TPyYZ1pnHSmRY3',
      priceId: 'price_1ST8bPP6vvUUervCBhhToXcu',
      features: [
        'Haircut once per 3rd month',
        'Professional styling',
        'Hair care consultation'
      ],
      popular: false
    },
    {
      id: 'middle',
      name: 'Premium',
      price: 1799, // SEK per month
      period: 'per month',
      productId: 'prod_TPyZQtv1WalSRt',
      priceId: 'price_1ST8cJP6vvUUervCnsiuAoRc',
      features: [
        'Consultation included',
        '2 haircuts per 3rd month',
        'Professional styling',
        'Hair care consultation',
        'Priority booking'
      ],
      popular: true
    },
    {
      id: 'premium',
      name: 'Elite',
      price: 2999, // SEK per month
      period: 'per month',
      productId: 'prod_TPya3oshJcOah6',
      priceId: 'price_1ST8cyP6vvUUervCFw4WkB1D',
      features: [
        'Haircut once every month',
        'Consultation included',
        'Hair loops done',
        'Professional styling',
        'Hair care consultation',
        'Priority booking',
        'Exclusive products access'
      ],
      popular: false
    }
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedPackage && formData.name && formData.email && formData.phone) {
      try {
        const selectedPkg = packages.find(p => p.id === selectedPackage)
        if (!selectedPkg) {
          alert('Invalid package selected')
          return
        }
        
        setIsProcessing(true)
        
        // Create Stripe checkout session for subscription
        const payload = {
          lineItems: [{
            price: selectedPkg.priceId,
            quantity: 1
          }],
          successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/join`,
          customerEmail: formData.email,
          productId: selectedPkg.productId // Include productId for tracking
        }

        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (response.ok && data.url) {
          // Redirect to Stripe checkout
          window.location.href = data.url
        } else {
          alert(data.error || 'Kunde inte skapa checkout-session. Försök igen.')
          setIsProcessing(false)
        }
      } catch (error) {
        console.error('Subscription error:', error)
        alert('Ett fel uppstod. Försök igen.')
        setIsProcessing(false)
      }
    }
  }

  return (
    <div className="join-us-page">
      <div className="container">
        <motion.div
          className="join-us-header"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="page-title">Join Us</h1>
          <p className="page-subtitle">Choose the perfect subscription package for your hair care needs</p>
        </motion.div>

        <div className="packages-grid">
          {packages.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              className={`package-card ${pkg.popular ? 'popular' : ''} ${selectedPackage === pkg.id ? 'selected' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              {pkg.popular && (
                <div className="popular-badge">Most Popular</div>
              )}
              <div className="package-header">
                <h2 className="package-name">{pkg.name}</h2>
                <div className="package-price">
                  <span className="price-amount">{pkg.price.toLocaleString('sv-SE')} kr</span>
                  <span className="price-period">/{pkg.period}</span>
                </div>
              </div>
              <ul className="package-features">
                {pkg.features.map((feature, idx) => (
                  <li key={idx}>
                    <span className="feature-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <motion.button
                className={`select-package-btn ${selectedPackage === pkg.id ? 'selected' : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selectedPackage === pkg.id ? 'Selected' : 'Select Package'}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {selectedPackage && (
          <motion.div
            className="subscription-form-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="form-title">Complete Your Subscription</h2>
            <p className="form-subtitle">
              You've selected the <strong>{packages.find(p => p.id === selectedPackage)?.name}</strong> package
            </p>
            <form className="subscription-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                  required
                />
              </div>

              <div className="selected-package-summary">
                <div className="summary-row">
                  <span>Package:</span>
                  <span>{packages.find(p => p.id === selectedPackage)?.name}</span>
                </div>
                <div className="summary-row">
                  <span>Price:</span>
                  <span className="summary-price">
                    {packages.find(p => p.id === selectedPackage)?.price.toLocaleString('sv-SE')} kr/{packages.find(p => p.id === selectedPackage)?.period}
                  </span>
                </div>
              </div>

              <motion.button
                type="submit"
                className="submit-subscription-btn"
                disabled={!formData.name || !formData.email || !formData.phone || isProcessing}
                whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                whileTap={{ scale: isProcessing ? 1 : 0.98 }}
              >
                {isProcessing ? 'Processing...' : 'Subscribe Now'}
              </motion.button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default JoinUs

