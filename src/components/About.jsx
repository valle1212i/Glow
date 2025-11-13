import React from 'react'
import { motion } from 'framer-motion'
import './About.css'

const About = () => {
  return (
    <div className="about-page">
      <div className="container">
        <motion.div
          className="about-hero-image"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="about-hero-overlay"></div>
          <motion.div
            className="about-header"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="about-title">About Glow</h1>
          </motion.div>
        </motion.div>

        <div className="about-content">
          <motion.section
            className="about-section section-right"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="section-heading">The Story</h2>
            <div className="section-text">
              <p>
                Glow represents a new era in hair care and styling. Born from a passion for excellence 
                and a commitment to quality, Glow brings together the finest ingredients and innovative 
                techniques to create products that transform your hair.
              </p>
              <p>
                Our journey began with a simple belief: everyone deserves to look and feel their best. 
                We combine professional-grade formulas with accessible pricing, making premium hair care 
                available to all.
              </p>
            </div>
          </motion.section>

          <motion.section
            className="about-section section-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="section-heading">Our Philosophy</h2>
            <div className="section-text">
              <p>
                At Glow, we believe in the power of simplicity and quality. Each product is carefully 
                crafted with attention to detail, using only the finest ingredients. We understand that 
                great hair starts with great care, and our products are designed to nourish, protect, 
                and enhance your natural beauty.
              </p>
              <p>
                Our approach is both creative and innovative, combining traditional techniques with 
                modern formulations. We're committed to sustainability and ethical practices, ensuring 
                that beauty doesn't come at the cost of our planet.
              </p>
            </div>
          </motion.section>

          <motion.section
            className="about-section section-right"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <h2 className="section-heading">The Glow Experience</h2>
            <div className="section-text">
              <p>
                Creating professional results at home is at the heart of what we do. Our products are 
                designed to give you salon-quality results in the comfort of your own space. Whether 
                you're looking for volume, texture, shine, or protection, Glow has the perfect solution 
                for your hair care needs.
              </p>
              <p>
                All Glow products are high-end formulations with a chic, modern aesthetic, yet remain 
                affordable and accessible. We believe that quality hair care should be available to 
                everyone, without compromise.
              </p>
            </div>
          </motion.section>

          <motion.section
            className="about-section section-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <h2 className="section-heading">Our Commitment</h2>
            <div className="section-text">
              <p>
                Professionalism and durability are our top priorities. Every product in the Glow range 
                is carefully tested and formulated to deliver exceptional results while preserving the 
                health and quality of your hair.
              </p>
              <p>
                We're proud to offer a complete range of hair care solutions that cater to all hair types 
                and styling needs. From daily essentials to specialized treatments, Glow is your partner 
                in achieving beautiful, healthy hair.
              </p>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

export default About

