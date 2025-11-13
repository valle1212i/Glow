import React from 'react'
import { motion } from 'framer-motion'
import './TopBanner.css'

const TopBanner = () => {
  return (
    <motion.div
      className="top-banner"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="banner-content">
        <span>📦 Free shipping on orders over €100</span>
        <span>☑️ Official website</span>
      </div>
    </motion.div>
  )
}

export default TopBanner

