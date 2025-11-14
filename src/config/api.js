// Backend API Configuration
export const API_CONFIG = {
  // Backend API base URL
  // In production, use relative URL to go through Express proxy (avoids CORS)
  // In development, use full URL or VITE_API_URL
  BASE_URL: import.meta.env.PROD 
    ? '/api' // Use proxy in production
    : (import.meta.env.VITE_API_URL || 'https://source-database.onrender.com'),
  
  // Tenant identifier for Glow Hairdressing (must match exactly in customer portal)
  TENANT: 'Glow Hairdressing',
  
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
  if (metaTag && metaTag.getAttribute('content')) {
    return metaTag.getAttribute('content')
  }
  
  // Otherwise fetch from API (but fail gracefully if backend is down)
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CSRF}`, {
      credentials: 'include'
      // Note: Timeout handling can be added if needed
    })
    
    // Check if response is OK and JSON
    if (!response.ok) {
      // Only log if it's not a server error (5xx) - those are expected when backend is down
      if (response.status < 500) {
        console.warn(`CSRF token fetch failed: ${response.status} ${response.statusText}`)
      }
      return '' // Return empty string, backend might not require CSRF
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      // Backend returned HTML (likely error page), return empty
      return '' // Return empty string
    }
    
    const data = await response.json()
    return data.csrfToken || ''
  } catch (error) {
    // Silently fail - backend might be down, but we'll try without CSRF token
    // Don't log network errors (502, 503, timeout) as they're expected when backend is down
    if (error.name !== 'AbortError' && error.name !== 'TypeError') {
      console.warn('Failed to fetch CSRF token:', error.message)
    }
    return ''
  }
}

