// Inventory Status Service
// See: Backend_Implementation_for_New_Customers.md - Inventory Status API section

import { API_CONFIG } from '../config/api'

/**
 * Check inventory status for a product
 * @param {string} productId - Product ID or SKU (case-sensitive!)
 * @returns {Promise<Object|null>} Inventory data or null if error/not found
 */
export async function checkInventoryStatus(productId) {
  if (!productId) {
    return null
  }

  const tenantId = API_CONFIG.TENANT
  
  try {
    const endpoint = API_CONFIG.ENDPOINTS.INVENTORY_STATUS(tenantId, productId)
    const url = import.meta.env.PROD 
      ? `${API_CONFIG.BASE_URL}${endpoint}`
      : `${API_CONFIG.BASE_URL}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'X-Tenant': tenantId
      }
    })
    
    if (!response.ok) {
      // Product not found or error - return null (graceful degradation)
      if (response.status !== 404) {
        console.warn(`Failed to fetch inventory for ${productId}:`, response.status)
      }
      return null
    }
    
    const data = await response.json()
    
    if (data.success && data.found) {
      return data.inventory
    }
    
    // Product not found in inventory
    return null
  } catch (error) {
    // Silently fail - inventory check is not critical for product display
    console.warn('Error checking inventory:', error.message)
    return null
  }
}

/**
 * Format stock display text based on inventory status
 * @param {Object} inventory - Inventory object from API
 * @returns {string} Formatted stock display text
 */
export function formatStockDisplay(inventory) {
  if (!inventory) {
    return 'I lager' // Default if inventory check fails
  }
  
  if (inventory.outOfStock) {
    return 'Slutsåld'
  }
  
  // Show count only when stock is low (< 5) or below threshold
  if (inventory.lowStock || inventory.stock < 5) {
    return `I lager (${inventory.stock} st)`
  }
  
  // Stock >= 5: Just show "I lager" without count
  return 'I lager'
}

