import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiInstagram, FiFacebook, FiTwitter } from 'react-icons/fi'
import './Footer.css'

const Footer = () => {
  const footerLinks = {
    about: [
      { label: 'About Glow', path: '/about' },
      { label: 'Locations', path: '/locations' },
      { label: 'Contact Us', path: '/contact' }
    ],
    help: [
      { label: 'FAQs', path: '/faqs' },
      { label: 'Shipping', path: '/shipping' },
      { label: 'Returns', path: '/returns' }
    ],
    legal: [
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Refund Policy', path: '/refund' }
    ]
  }

  const socialLinks = [
    { icon: FiInstagram, url: 'https://instagram.com' },
    { icon: FiFacebook, url: 'https://facebook.com' },
    { icon: FiTwitter, url: 'https://twitter.com' }
  ]

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <motion.div
            className="footer-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="footer-logo">GLOW</h3>
            <p className="footer-tagline">
              Premium hair care and styling for the modern you.
            </p>
            <div className="social-links">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={index}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.2, y: -3 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <social.icon />
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="footer-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4>About</h4>
            <ul>
              {footerLinks.about.map((link) => (
                <li key={link.path}>
                  <Link to={link.path}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="footer-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h4>Get Help</h4>
            <ul>
              {footerLinks.help.map((link) => (
                <li key={link.path}>
                  <Link to={link.path}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="footer-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h4>Join Us</h4>
            <p>For the latest releases, updates & offers.</p>
            <form className="newsletter-form">
              <input
                type="email"
                placeholder="Your email"
                required
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign Up
              </motion.button>
            </form>
            <p className="newsletter-disclaimer">
              By clicking the button you agree to the Privacy Policy and Terms and Conditions.
            </p>
          </motion.div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Glow Hairdresser. All Rights Reserved.</p>
          <div className="footer-legal">
            {footerLinks.legal.map((link) => (
              <Link key={link.path} to={link.path}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

