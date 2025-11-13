import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi'
import { useCart } from '../context/CartContext'
import './Cart.css'

const Cart = () => {
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    getTotalPrice
  } = useCart()

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            className="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
          />
          <motion.div
            className="cart-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="cart-header">
              <h2>Cart</h2>
              <button
                className="cart-close"
                onClick={() => setIsCartOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <div className="cart-content">
              {cartItems.length === 0 ? (
                <div className="cart-empty">
                  <FiShoppingBag size={48} />
                  <p>No products in the cart</p>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cartItems.map((item) => (
                      <motion.div
                        key={item.id}
                        className="cart-item"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <img src={item.image} alt={item.name} />
                        <div className="cart-item-info">
                          <h4>{item.name}</h4>
                          <p>{item.description}</p>
                          <div className="cart-item-controls">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <FiMinus />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <FiPlus />
                            </button>
                          </div>
                        </div>
                        <div className="cart-item-price">
                          <div>
                            {item.hasCampaign && (
                              <span className="campaign-badge" title={item.campaignName}>
                                Sale
                              </span>
                            )}
                            <p>€{(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                          </div>
                          <button
                            className="remove-item"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <FiX />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="cart-footer">
                    <div className="cart-total">
                      <span>Total:</span>
                      <span>€{getTotalPrice().toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button className="checkout-button">Checkout</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Cart

