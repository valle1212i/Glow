import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { subscribeToPackage } from '../services/api'
import './JoinUs.css'

const JoinUs = () => {
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const packages = [
    {
      id: 'basic',
      name: 'Basic',
      price: 89,
      period: 'per 3 months',
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
      price: 179,
      period: 'per 3 months',
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
      price: 299,
      period: 'per month',
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
        
        const result = await subscribeToPackage({
          packageId: selectedPkg.id,
          packageName: selectedPkg.name,
          price: selectedPkg.price,
          period: selectedPkg.period,
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        })
        
        if (result.success) {
          setSubmitted(true)
          // Reset form after 3 seconds
          setTimeout(() => {
            setSubmitted(false)
            setSelectedPackage(null)
            setFormData({ name: '', email: '', phone: '' })
          }, 3000)
        } else {
          alert(result.error || 'Failed to process subscription. Please try again.')
        }
      } catch (error) {
        console.error('Subscription error:', error)
        alert('An error occurred. Please try again.')
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
                  <span className="price-amount">€{pkg.price}</span>
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
                    €{packages.find(p => p.id === selectedPackage)?.price}/{packages.find(p => p.id === selectedPackage)?.period}
                  </span>
                </div>
              </div>

              <motion.button
                type="submit"
                className="submit-subscription-btn"
                disabled={!formData.name || !formData.email || !formData.phone}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {submitted ? 'Subscription Confirmed!' : 'Subscribe Now'}
              </motion.button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default JoinUs

