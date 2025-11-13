import React, { createContext, useContext, useState, useEffect } from 'react'
import { getCampaignPrice } from '../services/api'

const CartContext = createContext()

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Check for campaign prices when cart items change (only for items not yet checked)
  useEffect(() => {
    const checkCampaignPrices = async () => {
      const itemsToCheck = cartItems.filter(item => item.productId && !item.campaignPriceChecked)
      
      if (itemsToCheck.length === 0) {
        return // No items need checking
      }

      const updatedItems = await Promise.all(
        cartItems.map(async (item) => {
          if (item.productId && !item.campaignPriceChecked) {
            const campaignData = await getCampaignPrice(item.productId, item.priceId)
            return {
              ...item,
              campaignPriceId: campaignData.priceId,
              hasCampaign: campaignData.hasCampaign,
              campaignName: campaignData.campaignName,
              campaignPriceChecked: true
            }
          }
          return item
        })
      )
      
      setCartItems(updatedItems)
    }

    if (cartItems.length > 0) {
      checkCampaignPrices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems.length]) // Only run when cart items count changes

  const addToCart = async (product) => {
    // Check for campaign price when adding to cart
    let finalProduct = { ...product, quantity: 1, campaignPriceChecked: false }
    
    if (product.productId) {
      const campaignData = await getCampaignPrice(product.productId, product.priceId)
      finalProduct = {
        ...finalProduct,
        campaignPriceId: campaignData.priceId,
        hasCampaign: campaignData.hasCampaign,
        campaignName: campaignData.campaignName,
        campaignPriceChecked: true
      }
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id)
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, finalProduct]
    })
    setIsCartOpen(true)
  }

  const removeFromCart = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    )
  }

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      // Use campaign price if available, otherwise use regular price
      // Note: For now we use the display price, actual Stripe checkout will use campaignPriceId
      return total + item.price * item.quantity
    }, 0)
  }

  // Get the price ID to use for checkout (campaign price if available, otherwise regular)
  const getCheckoutPriceId = (item) => {
    return item.campaignPriceId || item.priceId
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        getTotalPrice,
        getTotalItems,
        getCheckoutPriceId,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

