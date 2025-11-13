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
    console.log('Frontend: Including CSRF token in request:', csrfToken.substring(0, 20) + '...')
    console.log('Frontend: Full request headers:', JSON.stringify(headers, null, 2))
  } else {
    console.warn('CSRF token is empty, request may fail if backend requires it')
  }
  
  const config = {
    ...options,
    headers,
    credentials: 'include' // Include cookies for session
  }
  
  try {
    const response = await fetch(url, config)
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type') || ''
    let data
    
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (parseError) {
        // If JSON parsing fails, try to get error message from text
        const text = await response.text()
        console.error('Failed to parse JSON response:', parseError)
        return {
          success: false,
          error: `Invalid response from server (${response.status})`,
          status: response.status
        }
      }
    } else {
      // Non-JSON response (likely HTML error page from 502/503)
      const text = await response.text()
      console.warn(`Server returned non-JSON (${contentType}): ${response.status}`)
      return {
        success: false,
        error: response.status === 502 
          ? 'Backend service is temporarily unavailable. Please try again later.'
          : `Server error: ${response.status} ${response.statusText}`,
        status: response.status
      }
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `API error: ${response.status}`,
        status: response.status,
        data
      }
    }
    
    return { success: true, data, status: response.status }
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
  
  // Get CSRF token (but continue even if it fails - backend might not require it)
  const csrfToken = await getCSRFToken()
  // Note: We continue even without CSRF token - backend will handle validation
  
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
  
  // Get CSRF token (but continue even if it fails - backend might not require it)
  const csrfToken = await getCSRFToken()
  // Note: We continue even without CSRF token - backend will handle validation
  
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
 * Fails silently if backend is unavailable (502, 503, etc.)
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
      // Note: Timeout handling can be added if needed for better UX
    })
    
    // Analytics tracking is fire-and-forget, don't throw errors
    if (!response.ok) {
      // Only log if it's not a server error (5xx) - those are expected when backend is down
      if (response.status < 500) {
        console.warn('Analytics tracking failed:', response.status)
      }
    }
    
    return { success: true }
  } catch (error) {
    // Silently fail analytics tracking to not disrupt user experience
    // Don't log network errors (502, 503, timeout) as they're expected when backend is down
    if (error.name !== 'AbortError' && error.name !== 'TypeError') {
      console.warn('Analytics tracking error:', error.message)
    }
    return { success: false }
  }
}

/**
 * Check for campaign price for a product
 * Returns campaign price ID if available, otherwise returns regular price ID
 * Fails gracefully if backend is unavailable (502, 503, etc.)
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
        // Note: Timeout handling can be added if needed
      }
    )

    if (!response.ok) {
      // If campaign check fails (404 = endpoint doesn't exist, 502/503 = backend down), fallback to regular price
      // Only log if it's an unexpected error (not 404, not 5xx)
      if (response.status !== 404 && response.status >= 500) {
        // Don't log 404s (endpoint doesn't exist) or 5xx (backend down) - these are expected
      } else if (response.status < 400 || (response.status >= 400 && response.status < 500 && response.status !== 404)) {
        console.warn('Campaign price check failed, using regular price')
      }
      return { success: true, priceId: regularPriceId, hasCampaign: false }
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      // Backend returned HTML (likely error page), fallback to regular price
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
    // Error checking campaign (network error, timeout, etc.), fallback to regular price
    // Don't log network errors as they're expected when backend is down
    if (error.name !== 'AbortError' && error.name !== 'TypeError') {
      console.warn('Error checking campaign price:', error.message)
    }
    return { success: true, priceId: regularPriceId, hasCampaign: false }
  }
}

/**
 * Create Stripe checkout session
 * Returns checkout session URL to redirect user to Stripe
 */
export const createCheckoutSession = async (cartItems, getCheckoutPriceId) => {
  // Get CSRF token (but don't fail if unavailable - backend might not require it)
  const csrfToken = await getCSRFToken()
  
  // Note: We continue even if CSRF token is empty, as the backend might handle it differently
  // Some endpoints might not require CSRF, or might accept requests without it

  // Build line items for Stripe checkout
  const lineItems = cartItems.map(item => ({
    price: getCheckoutPriceId(item), // Use campaign price if available, otherwise regular price
    quantity: item.quantity
  }))

  const payload = {
    tenant: API_CONFIG.TENANT,
    lineItems: lineItems,
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`
  }

  const result = await apiRequest(API_CONFIG.ENDPOINTS.STRIPE_CHECKOUT, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  if (result.success && result.data?.url) {
    // Redirect to Stripe checkout
    window.location.href = result.data.url
    return { success: true }
  }

  // Handle different error cases with user-friendly messages
  let errorMessage = 'Kunde inte skapa checkout-session. Försök igen.'
  
  if (result.status === 403) {
    errorMessage = 'Åtkomst nekad (403). Backend-endpointen kräver autentisering eller har inte implementerats ännu. Kontakta support för att aktivera Stripe checkout.'
  } else if (result.status === 404) {
    errorMessage = 'Checkout-endpoint hittades inte (404). Backend-tjänsten har inte implementerat Stripe checkout ännu. Kontakta support.'
  } else if (result.status === 502 || result.status === 503) {
    errorMessage = 'Backend-tjänsten är tillfälligt otillgänglig. Försök igen om en stund.'
  } else if (result.message) {
    // Use the message from backend if available
    errorMessage = result.message
  } else {
    errorMessage = result.error || result.data?.error || result.data?.message || errorMessage
  }
  
  console.error('Checkout failed:', {
    status: result.status,
    error: result.error,
    message: result.message,
    data: result.data
  })
  
  return {
    success: false,
    error: errorMessage,
    status: result.status
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

