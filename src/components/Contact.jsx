import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { sendContactMessage } from '../services/api'
import './Contact.css'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    company: '' // Honeypot field (must be empty)
  })
  const [submitted, setSubmitted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Honeypot check - if company field is filled, it's spam
    if (formData.company) {
      console.warn('Spam detected: honeypot field filled')
      return
    }
    
    // Email, phone, and message are required
    if (!formData.email || !formData.phone || !formData.message) {
      alert('Email, phone number, and message are required.')
      return
    }
    
    setIsProcessing(true)
    try {
      const result = await sendContactMessage({
        name: formData.name || '',
        email: formData.email,
        phone: formData.phone || '',
        subject: formData.subject || 'Kontaktformulär',
        message: formData.message
      })
      
      if (result.success) {
        setSubmitted(true)
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitted(false)
          setFormData({ 
            name: '', 
            email: '', 
            phone: '', 
            subject: '',
            message: '',
            company: ''
          })
        }, 3000)
      } else {
        alert(result.error || result.data?.message || 'Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Contact form error:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="contact-page">
      <div className="container">
        <motion.div
          className="contact-header"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="page-title">Contact Us</h1>
          <p className="page-subtitle">We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
        </motion.div>

        <div className="contact-container">
          <motion.div
            className="contact-info"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="info-section">
              <h2>Get in Touch</h2>
              <p>
                Have a question or want to book an appointment? Fill out the form and we'll get back to you as soon as possible.
              </p>
            </div>

            <div className="info-section">
              <h3>Visit Us</h3>
              <p>123 Hair Salon Street<br />City, Country 12345</p>
            </div>

            <div className="info-section">
              <h3>Contact Information</h3>
              <p>
                <strong>Email:</strong> info@glowhairdresser.com<br />
                <strong>Phone:</strong> +1 (234) 567-8900
              </p>
            </div>

            <div className="info-section">
              <h3>Opening Hours</h3>
              <p>
                Monday - Friday: 9:00 AM - 7:00 PM<br />
                Saturday: 9:00 AM - 6:00 PM<br />
                Sunday: Closed
              </p>
            </div>
          </motion.div>

          <motion.div
            className="contact-form-container"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <form className="contact-form" onSubmit={handleSubmit}>
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
                  placeholder="+46 123 456 789"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="What is this regarding?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Tell us how we can help you..."
                  rows="6"
                  required
                />
              </div>

              {/* Honeypot field - hidden from users, must be empty */}
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                style={{ display: 'none' }}
                tabIndex="-1"
                autoComplete="off"
              />

              <motion.button
                type="submit"
                className="submit-contact-btn"
                disabled={!formData.email || !formData.phone || !formData.message || isProcessing}
                whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                whileTap={{ scale: isProcessing ? 1 : 0.98 }}
              >
                {isProcessing ? 'Sending...' : submitted ? 'Message Sent!' : 'Send Message'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Contact

