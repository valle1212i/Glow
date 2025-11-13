import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import './Products.css'

const Products = () => {
  const { addToCart } = useCart()

  const hairProducts = [
    {
      id: 1,
      name: 'Volume Shampoo',
      description: 'EXTRA BODY + DEEP CLEANSE',
      price: 28,
      image: '/bottleisclean.png'
    },
    {
      id: 2,
      name: 'Hydrating Conditioner',
      description: 'MOISTURE + SMOOTH FINISH',
      price: 28,
      image: '/twobottles.png'
    },
    {
      id: 3,
      name: 'Styling Cream',
      description: 'FLEXIBLE HOLD + NATURAL SHINE',
      price: 32,
      image: '/showerbottle.png'
    },
    {
      id: 4,
      name: 'Texturizing Spray',
      description: 'BODY BUILDER + SOFT HOLD',
      price: 28,
      image: '/bottleisclean.png'
    },
    {
      id: 5,
      name: 'Heat Protectant',
      description: 'SHIELD + CONDITION',
      price: 30,
      image: '/lotion.png'
    },
    {
      id: 6,
      name: 'Finishing Oil',
      description: 'GLOSS + FRIZZ CONTROL',
      price: 35,
      image: '/showerbottle.png'
    },
    {
      id: 7,
      name: 'Lotion',
      description: 'BODY LOTION + SMOOTH SKIN',
      price: 32,
      image: '/shower.png'
    },
    {
      id: 8,
      name: 'Salt Water Spray',
      description: 'TEXTURE + WAVY STYLE',
      price: 28,
      image: '/bottleisclean.png'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut'
      }
    }
  }

  return (
    <section className="products-section">
      <div className="container">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">GLOW HAIR</h2>
        </motion.div>

        <motion.div
          className="products-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {hairProducts.map((product) => (
            <motion.div
              key={product.id}
              className="product-card"
              variants={itemVariants}
              whileHover={{ y: -10 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Link to={`/product/${product.id}`} className="product-link">
                <div className="product-image-wrapper">
                  <motion.img
                    src={product.image}
                    alt={product.name}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  <motion.button
                    className="add-to-cart-btn"
                    onClick={(e) => {
                      e.preventDefault()
                      addToCart(product)
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add to Cart
                  </motion.button>
                  <p className="product-description">{product.description}</p>
                  <p className="product-price">€{product.price.toFixed(2).replace('.', ',')}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Products

