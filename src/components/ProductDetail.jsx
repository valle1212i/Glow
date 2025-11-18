import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { FiArrowLeft } from 'react-icons/fi'
import { checkInventoryStatus, formatStockDisplay } from '../services/inventory'
import './ProductDetail.css'

// Product data - in a real app, this would come from an API
const allProducts = [
  {
    id: 1,
    name: 'Volume Shampoo',
    description: 'EXTRA BODY + DEEP CLEANSE',
    price: 349, // SEK
    image: '/glowvolumeschamppoo.png',
    productId: 'prod_TPyEGCJUN8hjjP',
    priceId: 'price_1ST8INP6vvUUervCyRnKqKzU',
    fullDescription: 'Our Volume Shampoo provides extra body and deep cleansing for all hair types. Formulated with natural ingredients to add volume and texture while maintaining hair health.'
  },
  {
    id: 2,
    name: 'Hydrating Conditioner',
    description: 'MOISTURE + SMOOTH FINISH',
    price: 479, // SEK
    image: '/twobottles.png',
    productId: 'prod_TPyF74HUAMTa5M',
    priceId: 'price_1ST8JQP6vvUUervC7t34RVoE',
    fullDescription: 'Intensive hydrating conditioner that restores moisture and provides a smooth, silky finish. Perfect for dry and damaged hair.'
  },
  {
    id: 3,
    name: 'Styling Cream',
    description: 'FLEXIBLE HOLD + NATURAL SHINE',
    price: 199, // SEK
    image: '/showerbottle.png',
    productId: 'prod_TPyG479iBgxuPf',
    priceId: 'price_1ST8KJP6vvUUervCuPav8iwH',
    fullDescription: 'Lightweight styling cream with flexible hold and natural shine. Perfect for creating texture and definition without stiffness.'
  },
  {
    id: 4,
    name: 'Texturizing Spray',
    description: 'BODY BUILDER + SOFT HOLD',
    price: 249, // SEK
    image: '/bottleisclean.png',
    productId: 'prod_TPyIf38nsbuiKs',
    priceId: 'price_1ST8M9P6vvUUervC1eUgI0Hp',
    fullDescription: 'Texturizing spray that adds body and volume with a soft, natural hold. Ideal for creating beachy waves and textured styles.'
  },
  {
    id: 5,
    name: 'Heat Protectant',
    description: 'SHIELD + CONDITION',
    price: 289, // SEK
    image: '/lotion.png',
    productId: 'prod_TPyJN5BCqOrXZC',
    priceId: 'price_1ST8MpP6vvUUervCN1dU34rM',
    fullDescription: 'Advanced heat protectant that shields hair from thermal damage while conditioning. Use before heat styling for maximum protection.'
  },
  {
    id: 6,
    name: 'Finishing Oil',
    description: 'GLOSS + FRIZZ CONTROL',
    price: 499, // SEK
    image: '/showerbottle.png',
    productId: 'prod_TPyK9y02nYbvrk',
    priceId: 'price_1ST8NcP6vvUUervC8ivVHW9p',
    fullDescription: 'Lightweight finishing oil that adds gloss and controls frizz. Perfect for smoothing flyaways and adding shine to finished styles.'
  },
  {
    id: 7,
    name: 'Lotion',
    description: 'BODY LOTION + SMOOTH SKIN',
    price: 279, // SEK
    image: '/shower.png',
    productId: 'prod_TPyLq0IPNEJdOH',
    priceId: 'price_1ST8OeP6vvUUervCm1YNFPLS',
    fullDescription: 'Luxurious body lotion that provides deep hydration and smooth skin. Enriched with natural ingredients for all-day moisture.'
  },
  {
    id: 8,
    name: 'Salt Water Spray',
    description: 'TEXTURE + WAVY STYLE',
    price: 329, // SEK
    image: '/seasalt.png',
    productId: 'prod_TPyMI03ik6NFBX',
    priceId: 'price_1ST8PNP6vvUUervCH0SDRr6k',
    fullDescription: 'Salt water spray that creates natural texture and wavy styles. Mimics the beachy look with added volume and definition.'
  }
]

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [inventory, setInventory] = useState(null)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  
  const product = allProducts.find(p => p.id === parseInt(id))

  // Check inventory status on mount
  useEffect(() => {
    if (product?.productId) {
      setInventoryLoading(true)
      checkInventoryStatus(product.productId).then((inv) => {
        setInventory(inv)
        setInventoryLoading(false)
      })
    } else {
      setInventoryLoading(false)
    }
  }, [product?.productId])

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
    if (inventory?.outOfStock) {
      return // Don't add to cart if out of stock
    }
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
              <span className="product-price">{product.price.toLocaleString('sv-SE')} kr</span>
            </div>

            {/* Inventory Status */}
            {!inventoryLoading && inventory && (
              <div className="inventory-status-section">
                {inventory.outOfStock && (
                  <span className="inventory-badge out-of-stock">Slutsåld</span>
                )}
                {inventory.lowStock && !inventory.outOfStock && (
                  <span className="inventory-badge low-stock">Snart slutsåld</span>
                )}
                <p className={`stock-count ${inventory.outOfStock ? 'out' : inventory.lowStock ? 'low' : 'in'}`}>
                  {formatStockDisplay(inventory)}
                </p>
              </div>
            )}

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
              className={`add-to-cart-button ${inventory?.outOfStock ? 'disabled' : ''}`}
              onClick={handleAddToCart}
              disabled={inventory?.outOfStock}
              whileHover={!inventory?.outOfStock ? { scale: 1.02 } : {}}
              whileTap={!inventory?.outOfStock ? { scale: 0.98 } : {}}
            >
              {inventory?.outOfStock ? 'Slutsåld' : 'Add to cart'}
            </motion.button>

            <div className="product-features">
              <div className="feature-item">
                <span>📦</span>
                <div>
                  <strong>Free shipping</strong>
                  <p>On orders over 1 000 kr</p>
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

