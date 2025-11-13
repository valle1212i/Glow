import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import './Experience.css'

const Experience = () => {
  const experiences = [
    {
      title: 'Expert Stylists',
      description: 'Discover your look',
      link: '/book',
      image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80',
      category: 'Salon'
    },
    {
      title: 'Premium Products',
      description: 'Professional hair care',
      link: '/shop',
      image: 'https://images.unsplash.com/photo-1522338247332-0c3bf0c60d83?w=800&q=80',
      category: 'Shop'
    },
    {
      title: 'Modern Techniques',
      description: 'Latest trends & styles',
      link: '/about',
      image: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
      category: 'About'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: 'easeOut'
      }
    }
  }

  return (
    <section className="experience-section">
      <div className="container">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">Experience Glow</h2>
        </motion.div>

        <motion.div
          className="experience-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {experiences.map((experience, index) => (
            <motion.div
              key={index}
              className="experience-card"
              variants={itemVariants}
              whileHover={{ y: -10 }}
            >
              <Link to={experience.link}>
                <div className="experience-image-wrapper">
                  <motion.img
                    src={experience.image}
                    alt={experience.title}
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="experience-overlay" />
                </div>
                <div className="experience-content">
                  <span className="experience-category">{experience.category}</span>
                  <h3 className="experience-title">{experience.title}</h3>
                  <p className="experience-description">{experience.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Experience

