import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { checkInventoryStatus, formatStockDisplay } from '../services/inventory'
import './Products.css'

const Products = () => {
  const { addToCart } = useCart()
  const [inventoryData, setInventoryData] = useState({})

  const hairProducts = [
    {
      id: 1,
      name: 'Volume Shampoo',
      description: 'EXTRA BODY + DEEP CLEANSE',
      price: 349, // SEK
      image: '/glowvolumeschamppoo.png',
      productId: 'prod_TPyEGCJUN8hjjP',
      priceId: 'price_1ST8INP6vvUUervCyRnKqKzU'
    },
    {
      id: 2,
      name: 'Hydrating Conditioner',
      description: 'MOISTURE + SMOOTH FINISH',
      price: 479, // SEK
      image: '/twobottles.png',
      productId: 'prod_TPyF74HUAMTa5M',
      priceId: 'price_1ST8JQP6vvUUervC7t34RVoE'
    },
    {
      id: 3,
      name: 'Styling Cream',
      description: 'FLEXIBLE HOLD + NATURAL SHINE',
      price: 199, // SEK
      image: '/showerbottle.png',
      productId: 'prod_TPyG479iBgxuPf',
      priceId: 'price_1ST8KJP6vvUUervCuPav8iwH'
    },
    {
      id: 4,
      name: 'Texturizing Spray',
      description: 'BODY BUILDER + SOFT HOLD',
      price: 249, // SEK
      image: '/bottleisclean.png',
      productId: 'prod_TPyIf38nsbuiKs',
      priceId: 'price_1ST8M9P6vvUUervC1eUgI0Hp'
    },
    {
      id: 5,
      name: 'Heat Protectant',
      description: 'SHIELD + CONDITION',
      price: 289, // SEK
      image: '/lotion.png',
      productId: 'prod_TPyJN5BCqOrXZC',
      priceId: 'price_1ST8MpP6vvUUervCN1dU34rM'
    },
    {
      id: 6,
      name: 'Finishing Oil',
      description: 'GLOSS + FRIZZ CONTROL',
      price: 499, // SEK
      image: '/showerbottle.png',
      productId: 'prod_TPyK9y02nYbvrk',
      priceId: 'price_1ST8NcP6vvUUervC8ivVHW9p'
    },
    {
      id: 7,
      name: 'Lotion',
      description: 'BODY LOTION + SMOOTH SKIN',
      price: 279, // SEK
      image: '/shower.png',
      productId: 'prod_TPyLq0IPNEJdOH',
      priceId: 'price_1ST8OeP6vvUUervCm1YNFPLS'
    },
    {
      id: 8,
      name: 'Salt Water Spray',
      description: 'TEXTURE + WAVY STYLE',
      price: 329, // SEK
      image: '/seasalt.png',
      productId: 'prod_TPyMI03ik6NFBX',
      priceId: 'price_1ST8PNP6vvUUervCH0SDRr6k'
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

  // Check inventory status for all products on mount
  useEffect(() => {
    const checkInventories = async () => {
      const inventoryPromises = hairProducts.map(async (product) => {
        if (product.productId) {
          const inventory = await checkInventoryStatus(product.productId)
          return { productId: product.productId, inventory }
        }
        return null
      })

      const results = await Promise.all(inventoryPromises)
      const inventoryMap = {}
      results.forEach((result) => {
        if (result && result.productId) {
          inventoryMap[result.productId] = result.inventory
        }
      })
      setInventoryData(inventoryMap)
    }

    checkInventories()
  }, [])

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
                  {/* Inventory Badge */}
                  {inventoryData[product.productId] && (
                    <>
                      {inventoryData[product.productId].outOfStock && (
                        <span className="inventory-badge out-of-stock">Slutsåld</span>
                      )}
                      {inventoryData[product.productId].lowStock && !inventoryData[product.productId].outOfStock && (
                        <span className="inventory-badge low-stock">Snart slutsåld</span>
                      )}
                    </>
                  )}
                </div>
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  <motion.button
                    className={`add-to-cart-btn ${inventoryData[product.productId]?.outOfStock ? 'disabled' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      if (!inventoryData[product.productId]?.outOfStock) {
                        addToCart(product)
                      }
                    }}
                    disabled={inventoryData[product.productId]?.outOfStock}
                    whileHover={!inventoryData[product.productId]?.outOfStock ? { scale: 1.05 } : {}}
                    whileTap={!inventoryData[product.productId]?.outOfStock ? { scale: 0.95 } : {}}
                  >
                    {inventoryData[product.productId]?.outOfStock ? 'Slutsåld' : 'Add to Cart'}
                  </motion.button>
                  <p className="product-description">{product.description}</p>
                  <p className="product-price">{product.price.toLocaleString('sv-SE')} kr</p>
                  {/* Stock Count */}
                  {inventoryData[product.productId] && (
                    <p className={`stock-count ${inventoryData[product.productId].outOfStock ? 'out' : inventoryData[product.productId].lowStock ? 'low' : 'in'}`}>
                      {formatStockDisplay(inventoryData[product.productId])}
                    </p>
                  )}
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

