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
  const { name, email, phone, subject, message } = messageData
  
  // Get CSRF token (but continue even if it fails - backend might not require it)
  const csrfToken = await getCSRFToken()
  // Note: We continue even without CSRF token - backend will handle validation
  
  const payload = {
    tenant: API_CONFIG.TENANT,
    name: name || '',
    email,
    phone: phone || '',
    subject: subject || 'Kontaktformulär', // Use provided subject or default to 'Kontaktformulär'
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

const getDeviceType = () => {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }
  const ua = navigator.userAgent?.toLowerCase() || ''
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile'
  return 'desktop'
}

const getTrafficSource = () => {
  if (typeof document === 'undefined') {
    return 'direct'
  }
  const ref = document.referrer || ''
  if (!ref) return 'direct'
  try {
    const url = new URL(ref)
    const host = url.hostname.toLowerCase()
    if (host.includes('google')) return 'organic'
    if (host.includes('facebook') || host.includes('instagram')) return 'social'
    return 'referral'
  } catch {
    return 'referral'
  }
}

/**
 * Track analytics event
 * Note: Analytics endpoint doesn't require CSRF protection
 * Fails silently if backend is unavailable (502, 503, etc.)
 */
export const trackEvent = async (eventType, eventData = {}) => {
  const defaultData = {
    page: typeof window !== 'undefined' ? window.location.pathname : '/',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    sessionId: getSessionId(),
    device: getDeviceType(),
    source: getTrafficSource(),
    timestamp: new Date().toISOString()
  }

  const payload = {
    event: eventType,
    tenant: API_CONFIG.TENANT,
    data: {
      ...defaultData,
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
 * Creates checkout session directly with Stripe (not through customer portal)
 * Returns checkout session URL to redirect user to Stripe
 */
export const createCheckoutSession = async (cartItems, getCheckoutPriceId) => {
  // Build line items for Stripe checkout
  // Use regular price IDs (campaign price lookup disabled for now)
  const lineItems = cartItems.map(item => ({
    price: getCheckoutPriceId(item), // Use regular price ID
    quantity: item.quantity
  }))

  // Get productId from first cart item (if available)
  const productId = cartItems.length > 0 ? cartItems[0].productId : null

  const payload = {
    lineItems: lineItems,
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`,
    productId: productId // Include productId for tracking (for single product purchases)
  }

  try {
    // 🔍 DEBUG: Log checkout initiation
    console.log('🛒 [ABANDONED CART] Initiating checkout session:', {
      cartItemsCount: cartItems.length,
      productId: productId || 'none',
      timestamp: new Date().toISOString()
    })

    // Call our own backend route (not customer portal)
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (response.ok && data.url) {
      // 🔍 DEBUG: Log successful session creation before redirect
      console.log('✅ [ABANDONED CART] Checkout session created successfully:', {
        sessionId: data.sessionId,
        url: data.url.substring(0, 50) + '...',
        redirecting: true,
        timestamp: new Date().toISOString()
      })
      console.log('📊 [ABANDONED CART] Session will be tracked by customer portal. If cancelled, will be marked as abandoned after 30 minutes.')
      
      // Redirect to Stripe checkout
      window.location.href = data.url
      return { success: true }
    }

    return {
      success: false,
      error: data.error || 'Kunde inte skapa checkout-session. Försök igen.',
      status: response.status
    }
  } catch (error) {
    console.error('Checkout failed:', error)
    return {
      success: false,
      error: 'Ett fel uppstod vid checkout. Försök igen.',
      status: 500
    }
  }
}

/**
 * Get or create session ID
 */
export const getSessionId = () => {
  let sessionId = sessionStorage.getItem('glow_session_id')
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    sessionStorage.setItem('glow_session_id', sessionId)
  }
  return sessionId
}

/**
 * Track geo analytics event
 * Requires consent and country code
 */
export const trackGeoEvent = async (eventData) => {
  if (!eventData?.consent) {
    console.warn('Geo event missing consent flag')
    return { success: false, error: 'Consent required' }
  }
  if (!eventData.country) {
    console.warn('Geo event missing country code')
    return { success: false, error: 'Country code required' }
  }

  try {
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': API_CONFIG.TENANT
      },
      body: JSON.stringify({ events: [eventData] })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.warn('Geo tracking failed:', response.status, errorData)
      return {
        success: false,
        status: response.status,
        error: errorData.message || 'Geo tracking failed'
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Geo tracking error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get booking services (active services)
 * Uses public endpoint - no authentication required
 */
export const getBookingServices = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_SERVICES}?isActive=true`, {
      headers: {
        'X-Tenant': API_CONFIG.TENANT
      }
      // No credentials needed for public endpoints
    })
    
    if (!response.ok) {
      // Handle 401 - should not happen if backend is correctly configured
      if (response.status === 401) {
        console.error('⚠️ Public booking services endpoint returned 401. Backend may need to be redeployed or configured.')
        return { 
          success: false, 
          services: [], 
          error: 'Failed to fetch services - authentication error',
          requiresBackendConfig: true
        }
      }
      return { success: false, services: [], error: `Failed to fetch services: ${response.status}` }
    }
    
    const data = await response.json()
    if (!data.success) {
      return { success: false, services: [], error: data.message || 'Failed to fetch services' }
    }
    
    return { success: true, services: data.services || [] }
  } catch (error) {
    console.error('Error fetching booking services:', error)
    return { success: false, services: [], error: error.message }
  }
}

/**
 * Get booking providers (active staff)
 * Uses public endpoint - no authentication required
 */
export const getBookingProviders = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_PROVIDERS}?isActive=true`, {
      headers: {
        'X-Tenant': API_CONFIG.TENANT
      }
      // No credentials needed for public endpoints
    })
    
    if (!response.ok) {
      // Handle 401 - should not happen if backend is correctly configured
      if (response.status === 401) {
        console.error('⚠️ Public booking providers endpoint returned 401. Backend may need to be redeployed or configured.')
        return { 
          success: false, 
          providers: [], 
          error: 'Failed to fetch providers - authentication error',
          requiresBackendConfig: true
        }
      }
      return { success: false, providers: [], error: `Failed to fetch providers: ${response.status}` }
    }
    
    const data = await response.json()
    if (!data.success) {
      return { success: false, providers: [], error: data.message || 'Failed to fetch providers' }
    }
    
    return { success: true, providers: data.providers || [] }
  } catch (error) {
    console.error('Error fetching booking providers:', error)
    return { success: false, providers: [], error: error.message }
  }
}

/**
 * Create a booking
 */
export const createBooking = async (bookingData) => {
  const { serviceId, providerId, date, startTime, duration, customerName, email, phone } = bookingData
  
  // Validate required fields
  if (!serviceId || !providerId || !date || !startTime || !customerName) {
    return {
      success: false,
      error: 'Service, provider, date, start time, and customer name are required.'
    }
  }
  
  // Get CSRF token
  const csrfToken = await getCSRFToken()
  if (!csrfToken) {
    return {
      success: false,
      error: 'Could not get security token. Please refresh the page and try again.'
    }
  }
  
  // Convert date and time to ISO format
  const startDate = new Date(`${date}T${startTime}`)
  const endDate = new Date(startDate.getTime() + (duration || 60) * 60000) // duration in minutes
  
  const payload = {
    serviceId,
    providerId,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    customerName,
    email: email || '',
    phone: phone || '',
    status: 'confirmed'
  }
  
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_BOOKINGS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Tenant': API_CONFIG.TENANT
      },
      credentials: 'include', // Required for CSRF validation on POST requests
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    
    // Handle conflict (double booking)
    if (response.status === 409) {
      return {
        success: false,
        conflict: true,
        error: 'This time slot is already booked. Please choose another time.'
      }
    }
    
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || data.error || 'Failed to create booking'
      }
    }
    
    return {
      success: true,
      booking: data.booking
    }
  } catch (error) {
    console.error('Error creating booking:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while creating the booking.'
    }
  }
}

/**
 * Get bookings for a date range
 */
export const getBookings = async (fromDate, toDate, providerId = null) => {
  try {
    const from = new Date(fromDate).toISOString()
    const to = new Date(toDate).toISOString()
    
    let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_BOOKINGS}?from=${from}&to=${to}`
    if (providerId) {
      url += `&providerId=${providerId}`
    }
    
    const response = await fetch(url, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      return { success: false, bookings: [], error: `Failed to fetch bookings: ${response.status}` }
    }
    
    const data = await response.json()
    return { success: true, bookings: data.bookings || [] }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return { success: false, bookings: [], error: error.message }
  }
}

