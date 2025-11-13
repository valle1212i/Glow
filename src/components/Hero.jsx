import React, { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import './Hero.css'

const Hero = () => {
  const heroRef = useRef(null)
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  })

  // Box container moves down as you scroll - starts immediately
  // Reduced distance for faster transition
  const boxY = useTransform(scrollYProgress, [0, 1], ["0%", "80vh"])
  
  // Clip path animation - reveals from all corners (shrinks inward)
  // Faster animation - completes earlier
  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.4, 0.8],
    ["inset(0% 0% 0% 0%)", "inset(25% 25% 25% 25%)", "inset(50% 50% 50% 50%)"]
  )
  
  // Opacity fades out faster
  const boxOpacity = useTransform(scrollYProgress, [0, 0.5, 0.8], [1, 0.3, 0])
  
  // Scale down effect from corners - faster
  const boxScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.5])

  return (
    <section ref={heroRef} className="hero">
      {/* Text content - always visible */}
      <div className="hero-content container">
        <motion.div
          className="hero-text"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.h2
            className="hero-subtitle"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            The New
          </motion.h2>
          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Classic
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <Link to="/shop" className="hero-button">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Shop Glow
              </motion.span>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Image box container that slides down */}
      <motion.div 
        className="hero-image-box"
        style={{
          y: boxY,
          clipPath: clipPath,
          opacity: boxOpacity,
          scale: boxScale
        }}
      >
        <div className="hero-background">
          <motion.div
            className="hero-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="hero-scroll-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        style={{
          opacity: useTransform(scrollYProgress, [0, 0.3], [1, 0])
        }}
      >
        <motion.div
          className="scroll-arrow"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>
    </section>
  )
}

export default Hero

