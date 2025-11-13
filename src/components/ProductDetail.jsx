import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { FiArrowLeft } from 'react-icons/fi'
import './ProductDetail.css'

// Product data - in a real app, this would come from an API
const allProducts = [
  {
    id: 1,
    name: 'Volume Shampoo',
    description: 'EXTRA BODY + DEEP CLEANSE',
    price: 28,
    image: '/bottleisclean.png',
    fullDescription: 'Our Volume Shampoo provides extra body and deep cleansing for all hair types. Formulated with natural ingredients to add volume and texture while maintaining hair health.'
  },
  {
    id: 2,
    name: 'Hydrating Conditioner',
    description: 'MOISTURE + SMOOTH FINISH',
    price: 28,
    image: '/twobottles.png',
    fullDescription: 'Intensive hydrating conditioner that restores moisture and provides a smooth, silky finish. Perfect for dry and damaged hair.'
  },
  {
    id: 3,
    name: 'Styling Cream',
    description: 'FLEXIBLE HOLD + NATURAL SHINE',
    price: 32,
    image: '/showerbottle.png',
    fullDescription: 'Lightweight styling cream with flexible hold and natural shine. Perfect for creating texture and definition without stiffness.'
  },
  {
    id: 4,
    name: 'Texturizing Spray',
    description: 'BODY BUILDER + SOFT HOLD',
    price: 28,
    image: '/bottleisclean.png',
    fullDescription: 'Texturizing spray that adds body and volume with a soft, natural hold. Ideal for creating beachy waves and textured styles.'
  },
  {
    id: 5,
    name: 'Heat Protectant',
    description: 'SHIELD + CONDITION',
    price: 30,
    image: '/lotion.png',
    fullDescription: 'Advanced heat protectant that shields hair from thermal damage while conditioning. Use before heat styling for maximum protection.'
  },
  {
    id: 6,
    name: 'Finishing Oil',
    description: 'GLOSS + FRIZZ CONTROL',
    price: 35,
    image: '/showerbottle.png',
    fullDescription: 'Lightweight finishing oil that adds gloss and controls frizz. Perfect for smoothing flyaways and adding shine to finished styles.'
  },
  {
    id: 7,
    name: 'Lotion',
    description: 'BODY LOTION + SMOOTH SKIN',
    price: 32,
    image: '/shower.png',
    fullDescription: 'Luxurious body lotion that provides deep hydration and smooth skin. Enriched with natural ingredients for all-day moisture.'
  },
  {
    id: 8,
    name: 'Salt Water Spray',
    description: 'TEXTURE + WAVY STYLE',
    price: 28,
    image: '/bottleisclean.png',
    fullDescription: 'Salt water spray that creates natural texture and wavy styles. Mimics the beachy look with added volume and definition.'
  }
]

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [quantity, setQuantity] = useState(1)
  
  const product = allProducts.find(p => p.id === parseInt(id))

  if (!product) {
    return (
      <div className="product-detail-container">
        <div className="container">
          <p>Product not found</p>
          <Link to="/shop">Back to Shop</Link>
        </div>
      </div>
    )
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product)
    }
  }

  return (
    <div className="product-detail-container">
      <div className="container">
        <motion.button
          className="back-button"
          onClick={() => navigate(-1)}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FiArrowLeft />
          <span>Back</span>
        </motion.button>

        <div className="product-detail-grid">
          {/* Product Images */}
          <motion.div
            className="product-images"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="main-image">
              <img src={product.image} alt={product.name} />
            </div>
          </motion.div>

          {/* Product Info */}
          <motion.div
            className="product-info-section"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="product-title">{product.name}</h1>
            <p className="product-subtitle">{product.description}</p>
            
            <div className="product-price-section">
              <span className="product-price">€{product.price.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="product-description">
              <p>{product.fullDescription}</p>
            </div>

            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>

            <motion.button
              className="add-to-cart-button"
              onClick={handleAddToCart}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Add to cart
            </motion.button>

            <div className="product-features">
              <div className="feature-item">
                <span>📦</span>
                <div>
                  <strong>Free shipping</strong>
                  <p>On orders over €100</p>
                </div>
              </div>
              <div className="feature-item">
                <span>☑️</span>
                <div>
                  <strong>Official website</strong>
                  <p>100% authentic products</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail

