import { API_CONFIG, getCSRFToken } from '../config/api'

/**
 * Generic API request function with CSRF protection
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`
  
  // Get CSRF token for POST/PUT/DELETE requests
  let csrfToken = ''
  if (['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase())) {
    csrfToken = await getCSRFToken()
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant': API_CONFIG.TENANT,
    ...options.headers
  }
  
  // Add CSRF token if available
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }
  
  const config = {
    ...options,
    headers,
    credentials: 'include' // Include cookies for session
  }
  
  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`)
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('API request failed:', error)
    return { 
      success: false, 
      error: error.message || 'Network error. Please try again.' 
    }
  }
}

/**
 * Book an appointment
 * Uses /api/messages endpoint (public, no authentication required)
 */
export const bookAppointment = async (appointmentData) => {
  const { date, time, name, email, phone } = appointmentData
  
  // Get CSRF token
  const csrfToken = await getCSRFToken()
  if (!csrfToken) {
    return {
      success: false,
      error: 'Kunde inte hämta säkerhetstoken. Ladda om sidan och försök igen.'
    }
  }
  
  // Combine date and time into ISO string
  const [hours, minutes] = time.split(':')
  const appointmentDateTime = new Date(date)
  appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  
  // Format date for display in message
  const formattedDate = appointmentDateTime.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Format appointment details in message
  const message = `Bokning begärd:

Tjänst: Hårklippning
Datum: ${formattedDate}
Telefon: ${phone || 'Ej angivet'}`
  
  const payload = {
    tenant: API_CONFIG.TENANT,
    name: name,
    email: email,
    phone: phone || '',
    subject: 'Bokning', // Use subject to identify appointment
    message: message,
    company: '' // Honeypot field (must be empty)
  }
  
  return apiRequest(API_CONFIG.ENDPOINTS.MESSAGES, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/**
 * Send contact message
 * Uses /api/messages endpoint (public, no authentication required)
 */
export const sendContactMessage = async (messageData) => {
  const { name, email, phone, message } = messageData
  
  // Get CSRF token
  const csrfToken = await getCSRFToken()
  if (!csrfToken) {
    return {
      success: false,
      error: 'Kunde inte hämta säkerhetstoken. Ladda om sidan och försök igen.'
    }
  }
  
  const payload = {
    tenant: API_CONFIG.TENANT,
    name,
    email,
    phone: phone || '',
    subject: 'Kontaktformulär', // Use subject to identify contact form
    message,
    company: '' // Honeypot field (must be empty)
  }
  
  return apiRequest(API_CONFIG.ENDPOINTS.MESSAGES, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/**
 * Subscribe to a package
 * Uses /api/messages endpoint (public, no authentication required)
 */
export const subscribeToPackage = async (subscriptionData) => {
  const { packageId, packageName, price, period, name, email, phone } = subscriptionData
  
  // Get CSRF token
  const csrfToken = await getCSRFToken()
  if (!csrfToken) {
    return {
      success: false,
      error: 'Kunde inte hämta säkerhetstoken. Ladda om sidan och försök igen.'
    }
  }
  
  // Format subscription details in message
  const message = `Prenumerationsintresse:

Paket: ${packageName || 'Ej angivet'}
Pris: ${price ? `${price} SEK` : 'Ej angivet'}
Period: ${period || 'Ej angivet'}`
  
  const payload = {
    tenant: API_CONFIG.TENANT,
    name: name,
    email: email,
    phone: phone || '',
    subject: 'Prenumeration', // Use subject to identify subscription
    message: message,
    company: '' // Honeypot field (must be empty)
  }
  
  return apiRequest(API_CONFIG.ENDPOINTS.MESSAGES, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/**
 * Track analytics event
 * Note: Analytics endpoint doesn't require CSRF protection
 */
export const trackEvent = async (eventType, eventData = {}) => {
  const payload = {
    event: eventType,
    tenant: API_CONFIG.TENANT,
    data: {
      page: window.location.pathname,
      referrer: document.referrer,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      ...eventData
    }
  }
  
  // Analytics endpoint doesn't require CSRF, so we make a direct fetch
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': API_CONFIG.TENANT
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    
    // Analytics tracking is fire-and-forget, don't throw errors
    if (!response.ok) {
      console.warn('Analytics tracking failed:', response.status)
    }
    
    return { success: true }
  } catch (error) {
    // Silently fail analytics tracking to not disrupt user experience
    console.warn('Analytics tracking error:', error)
    return { success: false }
  }
}

/**
 * Check for campaign price for a product
 * Returns campaign price ID if available, otherwise returns regular price ID
 */
export const getCampaignPrice = async (productId, regularPriceId) => {
  if (!productId) {
    return { success: true, priceId: regularPriceId, hasCampaign: false }
  }

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CAMPAIGN_PRICE}/${productId}?tenant=${API_CONFIG.TENANT}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': API_CONFIG.TENANT
        },
        credentials: 'include'
      }
    )

    if (!response.ok) {
      // If campaign check fails, fallback to regular price
      console.warn('Campaign price check failed, using regular price')
      return { success: true, priceId: regularPriceId, hasCampaign: false }
    }

    const data = await response.json()

    if (data.success && data.hasCampaignPrice) {
      return {
        success: true,
        priceId: data.priceId,
        hasCampaign: true,
        campaignName: data.campaignName
      }
    }

    // No campaign price available, use regular price
    return { success: true, priceId: regularPriceId, hasCampaign: false }
  } catch (error) {
    // Error checking campaign, fallback to regular price
    console.warn('Error checking campaign price:', error)
    return { success: true, priceId: regularPriceId, hasCampaign: false }
  }
}

/**
 * Get or create session ID
 */
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('glow_session_id')
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    sessionStorage.setItem('glow_session_id', sessionId)
  }
  return sessionId
}

