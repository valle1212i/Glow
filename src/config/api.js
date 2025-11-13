// Backend API Configuration
export const API_CONFIG = {
  // Backend API base URL
  // In production, use relative URL to go through Express proxy (avoids CORS)
  // In development, use full URL or VITE_API_URL
  BASE_URL: import.meta.env.PROD 
    ? '/api' // Use proxy in production
    : (import.meta.env.VITE_API_URL || 'https://source-database.onrender.com'),
  
  // Tenant identifier for Glow hairdresser
  TENANT: 'hairdresser',
  
  // API endpoints
  // In production, these are relative to BASE_URL (/api), so they don't include /api prefix
  // In development, BASE_URL is the full backend URL, so endpoints include /api prefix
  ENDPOINTS: {
    // Contact Messages (used for all public forms: appointments, subscriptions, contact)
    MESSAGES: import.meta.env.PROD ? '/messages' : '/api/messages',
    
    // CSRF Token
    CSRF: import.meta.env.PROD ? '/auth/csrf' : '/api/auth/csrf',
    
    // Analytics
    ANALYTICS: import.meta.env.PROD ? '/analytics/track' : '/api/analytics/track',
    
    // Campaign Price Check
    CAMPAIGN_PRICE: import.meta.env.PROD ? '/campaigns/price' : '/api/campaigns/price',
    
    // Stripe Checkout
    STRIPE_CHECKOUT: import.meta.env.PROD ? '/stripe/checkout' : '/api/stripe/checkout'
  }
}

// Get CSRF token from meta tag or fetch from API
export const getCSRFToken = async () => {
  // Try to get from meta tag first
  const metaTag = document.querySelector('meta[name="csrf-token"]')
  if (metaTag) {
    return metaTag.getAttribute('content')
  }
  
  // Otherwise fetch from API
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CSRF}`, {
      credentials: 'include'
    })
    const data = await response.json()
    return data.csrfToken || ''
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error)
    return ''
  }
}

