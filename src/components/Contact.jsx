import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { sendContactMessage } from '../services/api'
import './Contact.css'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.name && formData.email && formData.phone && formData.message) {
      try {
        const result = await sendContactMessage(formData)
        
        if (result.success) {
          setSubmitted(true)
          // Reset form after 3 seconds
          setTimeout(() => {
            setSubmitted(false)
            setFormData({ name: '', email: '', phone: '', message: '' })
          }, 3000)
        } else {
          alert(result.error || 'Failed to send message. Please try again.')
        }
      } catch (error) {
        console.error('Contact form error:', error)
        alert('An error occurred. Please try again.')
      }
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
                  placeholder="+1 234 567 8900"
                  required
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

              <motion.button
                type="submit"
                className="submit-contact-btn"
                disabled={!formData.name || !formData.email || !formData.phone || !formData.message}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {submitted ? 'Message Sent!' : 'Send Message'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Contact

