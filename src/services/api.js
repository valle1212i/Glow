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
 * Uses new storefront checkout endpoint with shipping options, stock validation, and order creation
 * Returns checkout session URL to redirect user to Stripe
 */
/**
 * Fetch product details from storefront API to get articleNumber
 * Looks up articleNumber by matching stripePriceId with product variants
 */
const fetchProductArticleNumber = async (stripePriceId, productId) => {
  if (!stripePriceId && !productId) {
    console.warn('⚠️ [STOREFRONT CHECKOUT] Cannot fetch articleNumber: missing stripePriceId and productId')
    return null
  }

  try {
    // Try to fetch all products and find the one matching our priceId
    const productsUrl = API_CONFIG.ENDPOINTS.STOREFRONT_PRODUCTS(API_CONFIG.TENANT)
    
    console.log('🔍 [STOREFRONT CHECKOUT] Fetching products from:', productsUrl)
    
    const response = await fetch(productsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': API_CONFIG.TENANT
      }
    })

    console.log('📥 [STOREFRONT CHECKOUT] Products API response:', {
      status: response.status,
      ok: response.ok,
      url: productsUrl
    })

    if (!response.ok) {
      console.warn(`❌ [STOREFRONT CHECKOUT] Failed to fetch products: ${response.status} ${response.statusText}`)
      // Try to get error message
      try {
        const errorText = await response.text()
        console.warn('Error response:', errorText)
      } catch (e) {
        // Ignore
      }
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      console.warn('❌ [STOREFRONT CHECKOUT] Products API returned non-JSON:', contentType)
      return null
    }

    const data = await response.json()
    
    console.log('📦 [STOREFRONT CHECKOUT] Products API data structure:', {
      hasSuccess: 'success' in data,
      hasProducts: 'products' in data,
      productsIsArray: Array.isArray(data.products),
      productsCount: Array.isArray(data.products) ? data.products.length : 0,
      dataKeys: Object.keys(data)
    })
    
    if (data.success && data.products && Array.isArray(data.products)) {
      console.log('🔍 [STOREFRONT CHECKOUT] Searching for articleNumber:', {
        stripePriceId: stripePriceId,
        productId: productId,
        productsCount: data.products.length
      })
      
      // Log the FULL API response to see what we're working with
      console.log('📦 [STOREFRONT CHECKOUT] FULL API RESPONSE:', JSON.stringify(data, null, 2))
      
      // Log first product structure to understand the data format
      if (data.products.length > 0) {
        console.log('📋 [STOREFRONT CHECKOUT] Sample product structure:', {
          productKeys: Object.keys(data.products[0]),
          hasVariants: 'variants' in data.products[0],
          variantsType: typeof data.products[0].variants,
          variantsIsArray: Array.isArray(data.products[0].variants),
          sampleProduct: JSON.stringify(data.products[0], null, 2)
        })
        
        if (data.products[0].variants && Array.isArray(data.products[0].variants) && data.products[0].variants.length > 0) {
          console.log('📋 [STOREFRONT CHECKOUT] Sample variant structure:', {
            variantKeys: Object.keys(data.products[0].variants[0]),
            sampleVariant: JSON.stringify(data.products[0].variants[0], null, 2)
          })
        } else {
          console.warn('⚠️ [STOREFRONT CHECKOUT] First product has no variants or variants is not an array:', {
            product: data.products[0],
            variants: data.products[0].variants
          })
        }
      }
      
      // Find product that has a variant with matching stripePriceId
      // The API uses stripePriceId field in variants
      console.log('🔍 [STOREFRONT CHECKOUT] Searching for stripePriceId:', stripePriceId)
      
      for (const product of data.products) {
        if (product.variants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            // API uses stripePriceId field directly
            if (variant.stripePriceId === stripePriceId) {
              const articleNumber = variant.articleNumber
              console.log('✅ [STOREFRONT CHECKOUT] Found articleNumber by stripePriceId:', {
                articleNumber: articleNumber,
                stripePriceId: stripePriceId,
                productTitle: product.title
              })
              return articleNumber
            }
          }
        }
      }
      
      // If not found by priceId, try by productId (API uses stripeProductId)
      // Try different possible field names for product ID
      if (productId) {
        console.log('🔍 [STOREFRONT CHECKOUT] stripePriceId not found, trying productId:', productId)
        
        for (const product of data.products) {
          // API uses stripeProductId field, not productId
          const prodId = product.stripeProductId || product.productId || product.product_id || product.id
          
          if (prodId === productId && product.variants && Array.isArray(product.variants)) {
            // Return first variant's articleNumber
            if (product.variants.length > 0) {
              const variant = product.variants[0]
              const articleNumber = variant.articleNumber
              if (articleNumber) {
                console.log('✅ [STOREFRONT CHECKOUT] Found articleNumber by productId:', {
                  articleNumber: articleNumber,
                  productId: productId,
                  productTitle: product.title
                })
                return articleNumber
              }
            }
          }
        }
      }
      
      // Log all available stripePriceIds for debugging
      console.log('📋 [STOREFRONT CHECKOUT] Available stripePriceIds in API:', 
        data.products.flatMap(p => 
          p.variants?.map(v => ({
            articleNumber: v.articleNumber,
            stripePriceId: v.stripePriceId,
            productTitle: p.title
          })) || []
        )
      )
      
      // Log all products and their variants for debugging
      console.log('🔍 [STOREFRONT CHECKOUT] All products and variants:', data.products.map(p => ({
        productId: p.productId || p.product_id || p.id,
        variants: p.variants?.map(v => ({
          articleNumber: v.articleNumber || v.article_number || v.sku,
          priceId: v.stripePriceId || v.priceId || v.stripe_price_id || v.price_id
        })) || []
      })))
      
      console.warn('⚠️ [STOREFRONT CHECKOUT] Could not find articleNumber in products:', {
        stripePriceId: stripePriceId,
        productId: productId,
        searchedProducts: data.products.length
      })
    } else {
      console.warn('⚠️ [STOREFRONT CHECKOUT] Unexpected products API response format:', {
        success: data.success,
        hasProducts: 'products' in data,
        productsType: typeof data.products,
        data: data
      })
    }
    
    return null
  } catch (error) {
    console.error('❌ [STOREFRONT CHECKOUT] Failed to fetch articleNumber:', error)
    return null
  }
}

export const createCheckoutSession = async (cartItems, getCheckoutPriceId) => {
  // First, try to fetch missing articleNumbers from storefront API
  const itemsWithArticleNumbers = await Promise.all(
    cartItems.map(async (item) => {
      let articleNumber = item.articleNumber || item.variantId
      
      // If articleNumber is missing, try to fetch it from storefront API
      if (!articleNumber) {
        const stripePriceId = getCheckoutPriceId(item)
        console.log('🔍 [STOREFRONT CHECKOUT] Fetching articleNumber for item:', {
          name: item.name,
          productId: item.productId,
          stripePriceId: stripePriceId
        })
        
        articleNumber = await fetchProductArticleNumber(stripePriceId, item.productId)
        
        if (articleNumber) {
          console.log('✅ [STOREFRONT CHECKOUT] Found articleNumber:', articleNumber)
          // Update the item with articleNumber for future use
          item.articleNumber = articleNumber
        } else {
          console.warn('⚠️ [STOREFRONT CHECKOUT] Could not fetch articleNumber for item:', item.name)
        }
      }
      
      return {
        ...item,
        articleNumber: articleNumber
      }
    })
  )
  
  // Convert cart items to new storefront checkout format
  // Format: { variantId, quantity, stripePriceId, priceSEK }
  // IMPORTANT: variantId must be the articleNumber from the product variant (e.g., "VALJ-S-Black")
  // NOT productId (prod_xxx) or priceId (price_xxx)
  const items = itemsWithArticleNumbers.map(item => {
    const variantId = item.articleNumber || item.variantId
    
    if (!variantId) {
      console.error('❌ [STOREFRONT CHECKOUT] Missing articleNumber for item:', {
        itemId: item.id,
        productId: item.productId,
        priceId: item.priceId,
        name: item.name,
        note: 'Products must include articleNumber field. Fetch from /storefront/:tenant/products or /storefront/:tenant/product/:productId'
      })
    }
    
    return {
      variantId: variantId, // Must be articleNumber (e.g., "VALJ-S-Black"), not productId or priceId
      quantity: item.quantity,
      stripePriceId: getCheckoutPriceId(item), // Use campaign price if available, otherwise regular price
      priceSEK: Math.round(item.price * 100) // Convert SEK to öre (cents)
    }
  })
  
  // Validate that all items have variantId (articleNumber)
  const missingVariantIds = items.filter(item => !item.variantId)
  if (missingVariantIds.length > 0) {
    console.error('❌ [STOREFRONT CHECKOUT] Some items are missing articleNumber:', missingVariantIds)
    return {
      success: false,
      error: 'Några produkter saknar artikelnummer (articleNumber). Produkter måste inkludera articleNumber från produktvarianten. Hämta från /storefront/:tenant/products eller lägg till manuellt.',
      status: 400
    }
  }

  // Build payload for storefront checkout endpoint
  const payload = {
    items: items,
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`
    // customerEmail is optional - Stripe will collect it if not provided
    // recipientAddress is optional - can be added for PostNord dynamic rates
  }

  try {
    // 🔍 DEBUG: Log checkout initiation with item details
    console.log('🛒 [STOREFRONT CHECKOUT] Initiating checkout session:', {
      cartItemsCount: cartItems.length,
      itemsCount: items.length,
      tenant: API_CONFIG.TENANT,
      items: items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        stripePriceId: item.stripePriceId,
        priceSEK: item.priceSEK
      })),
      timestamp: new Date().toISOString()
    })

    // Get CSRF token for POST request
    const csrfToken = await getCSRFToken()
    
    // Call backend storefront checkout endpoint
    // Note: STOREFRONT_CHECKOUT returns full backend URL (endpoint is not under /api)
    const checkoutUrl = API_CONFIG.ENDPOINTS.STOREFRONT_CHECKOUT(API_CONFIG.TENANT)
    
    // Build headers with CSRF token and tenant
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant': API_CONFIG.TENANT
    }
    
    // Add CSRF token if available
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    } else {
      console.warn('⚠️ [STOREFRONT CHECKOUT] CSRF token is empty, request may fail if backend requires it')
    }
    
    const response = await fetch(checkoutUrl, {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Include cookies for session
      body: JSON.stringify(payload)
    })

    // Check content type before parsing
    const contentType = response.headers.get('content-type') || ''
    let data
    
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (parseError) {
        // If JSON parsing fails, try to get error message from text
        const text = await response.text()
        console.error('❌ [STOREFRONT CHECKOUT] Failed to parse JSON response:', parseError)
        return {
          success: false,
          error: `Ogiltigt svar från servern (${response.status})`,
          status: response.status
        }
      }
    } else {
      // Non-JSON response (likely HTML error page)
      const text = await response.text()
      console.error(`❌ [STOREFRONT CHECKOUT] Server returned non-JSON (${contentType}): ${response.status}`)
      return {
        success: false,
        error: response.status === 403 
          ? 'Ogiltig eller saknad CSRF-token. Ladda om sidan och försök igen.'
          : `Serverfel: ${response.status} ${response.statusText}`,
        status: response.status
      }
    }

    if (response.ok && data.success && data.checkoutUrl) {
      // 🔍 DEBUG: Log successful session creation before redirect
      console.log('✅ [STOREFRONT CHECKOUT] Checkout session created successfully:', {
        sessionId: data.sessionId,
        orderId: data.orderId,
        checkoutUrl: data.checkoutUrl.substring(0, 50) + '...',
        expiresAt: data.expiresAt,
        redirecting: true,
        timestamp: new Date().toISOString()
      })
      console.log('📊 [STOREFRONT CHECKOUT] Features: Shipping options, stock validation, order creation')
      
      // Redirect to Stripe checkout
      window.location.href = data.checkoutUrl
      return { success: true }
    }

    // Handle errors - extract error message from response
    let errorMessage = 'Kunde inte skapa checkout-session. Försök igen.'
    
    if (data) {
      // Try different error message fields
      errorMessage = data.error || data.message || data.errorMessage || errorMessage
      
      // Handle specific error types
      if (errorMessage.includes('Out of stock') || errorMessage.includes('out of stock')) {
        errorMessage = 'Produkten är tyvärr slutsåld. Vänligen ta bort den från varukorgen och försök igen.'
      } else if (errorMessage.includes('stock')) {
        errorMessage = 'Lagerproblem: ' + errorMessage
      }
    }
    
    console.error('❌ [STOREFRONT CHECKOUT] Checkout failed:', {
      status: response.status,
      error: errorMessage,
      data: data
    })

    return {
      success: false,
      error: errorMessage,
      status: response.status
    }
  } catch (error) {
    console.error('❌ [STOREFRONT CHECKOUT] Checkout failed:', error)
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
  const { serviceId, providerId, date, startTime, duration, customerName, email, phone, partySize, notes, specialRequests } = bookingData
  
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
  
  // ✅ CRITICAL: Construct dates in local time to avoid timezone issues
  // Parse date and time separately to ensure correct local time construction
  const [year, month, day] = date.split('-').map(Number) // "2025-12-12" -> [2025, 12, 12]
  const [hours, minutes] = startTime.split(':').map(Number) // "14:30" -> [14, 30]
  
  // Create Date object in local time (not UTC)
  // Note: month is 0-indexed in JavaScript Date constructor (0 = January, 11 = December)
  const startLocal = new Date(year, month - 1, day, hours, minutes, 0, 0)
  const endLocal = new Date(startLocal.getTime() + (duration || 60) * 60000) // duration in minutes
  
  // ✅ Get user's timezone for backend to use in validation
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneOffset = startLocal.getTimezoneOffset() // Offset in minutes (negative for ahead of UTC)
  
  // Calculate time components for detailed logging
  const startHour = startLocal.getHours()
  const startMin = startLocal.getMinutes()
  const endHour = endLocal.getHours()
  const endMin = endLocal.getMinutes()
  
  console.log('📅 [BOOKING] Booking dates:', {
    selectedDate: date,
    selectedTime: startTime,
    startLocal: startLocal.toLocaleString('sv-SE'),
    startISO: startLocal.toISOString(),
    endLocal: endLocal.toLocaleString('sv-SE'),
    endISO: endLocal.toISOString(),
    startTimeComponents: { hour: startHour, minute: startMin },
    endTimeComponents: { hour: endHour, minute: endMin },
    duration: duration || 60,
    timezone: userTimezone,
    timezoneOffset: timezoneOffset,
    timezoneOffsetHours: -timezoneOffset / 60 // Convert to hours for readability
  })
  
  const payload = {
    serviceId,
    providerId,
    start: startLocal.toISOString(), // ✅ Use ISO string from local time
    end: endLocal.toISOString(),     // ✅ Use ISO string from local time
    customerName,
    email: email || '',
    phone: phone || '',
    status: 'confirmed',
    // ✅ Send timezone information to help backend validate correctly
    timezone: userTimezone, // e.g., "Europe/Madrid"
    timezoneOffset: timezoneOffset // Offset in minutes (e.g., -60 for UTC+1)
  }
  
  console.log('📤 [BOOKING] Sending booking payload:', {
    ...payload,
    start: payload.start,
    end: payload.end
  })
  
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
    
    console.log('📥 [BOOKING] Backend response:', {
      status: response.status,
      success: data.success,
      message: data.message,
      error: data.error,
      conflicts: data.conflicts
    })
    
    // Log detailed conflict information
    if (data.conflicts && Array.isArray(data.conflicts) && data.conflicts.length > 0) {
      console.log('🔍 [BOOKING] Detailed conflict information:')
      data.conflicts.forEach((conflict, index) => {
        console.log(`  Conflict ${index + 1}:`, JSON.stringify(conflict, null, 2))
        
        // Log time comparison if available
        if (conflict.generalHours) {
          const [ghStartH, ghStartM] = conflict.generalHours.start?.split(':').map(Number) || [null, null]
          const [ghEndH, ghEndM] = conflict.generalHours.end?.split(':').map(Number) || [null, null]
          const [selectedH, selectedM] = startTime.split(':').map(Number)
          
          console.log(`  ⏰ [BOOKING] Time comparison:`, {
            selectedTime: `${selectedH}:${selectedM.toString().padStart(2, '0')}`,
            generalHours: `${ghStartH}:${ghStartM?.toString().padStart(2, '0') || '00'}-${ghEndH}:${ghEndM?.toString().padStart(2, '0') || '00'}`,
            bookingStartISO: payload.start,
            bookingEndISO: payload.end,
            isWithinHours: ghStartH !== null && ghEndH !== null && 
              (selectedH > ghStartH || (selectedH === ghStartH && selectedM >= ghStartM)) &&
              (selectedH < ghEndH || (selectedH === ghEndH && selectedM < ghEndM))
          })
        }
      })
    }
    
    // Handle conflict (double booking or outside working hours)
    if (response.status === 409) {
      // Show backend's specific error message if available
      let errorMessage = data.message || data.error || 'This time slot is already booked. Please choose another time.'
      const conflictDetails = data.conflicts || []
      
      // Check if it's a provider availability issue
      const providerConflict = conflictDetails.find(c => c.type === 'PROVIDER_UNAVAILABLE' && c.reason === 'OUTSIDE_WORKING_HOURS')
      
      if (providerConflict) {
        // ✅ NEW: Use improved conflict information from backend
        const usingGeneralHours = providerConflict.usingGeneralHours === true
        const hasSpecificHours = providerConflict.hasSpecificHours === true
        
        // Check if backend provided suggested slots
        if (providerConflict.suggestedSlots && providerConflict.suggestedSlots.length > 0) {
          const suggestedTimes = providerConflict.suggestedSlots.slice(0, 5).join(', ') // Show first 5 slots
          const moreSlots = providerConflict.suggestedSlots.length > 5 ? ` (+${providerConflict.suggestedSlots.length - 5} fler)` : ''
          
          if (usingGeneralHours) {
            errorMessage = `Denna tid är utanför arbetstiderna. Föreslagna tider: ${suggestedTimes}${moreSlots}`
          } else {
            errorMessage = `Denna tid är inte tillgänglig för den valda personalen. Föreslagna tider: ${suggestedTimes}${moreSlots}`
          }
        } else if (usingGeneralHours && providerConflict.generalHours) {
          // Using general hours - show them to user with more context
          const generalHours = providerConflict.generalHours
          if (generalHours.start && generalHours.end) {
            // Extract time components for better error message
            const [selectedH, selectedM] = startTime.split(':').map(Number)
            const [ghStartH, ghStartM] = generalHours.start.split(':').map(Number)
            const [ghEndH, ghEndM] = generalHours.end.split(':').map(Number)
            
            // Check if selected time is actually within hours (for debugging)
            const isWithinHours = (selectedH > ghStartH || (selectedH === ghStartH && selectedM >= ghStartM)) &&
              (selectedH < ghEndH || (selectedH === ghEndH && selectedM < ghEndM))
            
            if (!isWithinHours) {
              // Time is actually outside - show normal error
              errorMessage = `Denna tid (${startTime}) är utanför arbetstiderna (${generalHours.start}-${generalHours.end}). Vänligen välj en annan tid.`
            } else {
              // Time appears to be within hours but backend rejected it - this might be a backend bug
              errorMessage = `Bokningen kunde inte genomföras. Den valda tiden (${startTime}) verkar vara inom arbetstiderna (${generalHours.start}-${generalHours.end}), men backend avvisade den. Vänligen försök igen eller kontakta oss direkt.`
              console.error('⚠️ [BOOKING] Backend rejected booking even though time appears within hours:', {
                selectedTime: startTime,
                generalHours: generalHours,
                isWithinHours: isWithinHours,
                payload: payload
              })
            }
          } else {
            errorMessage = 'Denna tid är utanför arbetstiderna. Vänligen välj en annan tid.'
          }
        } else if (!hasSpecificHours) {
          // Provider has no specific hours configured
          errorMessage = 'Denna personalmedlem har inga arbetstider konfigurerade. Vänligen konfigurera arbetstider i kundportalen eller välj en annan personalmedlem.'
          console.error('❌ [BOOKING] Provider has no working hours configured:', {
            providerId: providerId,
            date: date,
            time: startTime,
            conflict: providerConflict
          })
        } else {
          // Provider has specific hours but this time is outside them
          const providerHours = providerConflict.providerAvailability
          if (providerHours && providerHours.start && providerHours.end) {
            errorMessage = `Denna tid är utanför personalens arbetstider (${providerHours.start}-${providerHours.end}). Vänligen välj en annan tid.`
          } else {
            errorMessage = 'Denna tid är inte tillgänglig för den valda personalen. Vänligen välj en annan tid.'
          }
        }
      }
      
      console.error('❌ [BOOKING] Conflict detected:', {
        message: errorMessage,
        conflicts: conflictDetails,
        payload: payload
      })
      
      return {
        success: false,
        conflict: true,
        error: errorMessage,
        conflicts: conflictDetails
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
 * ✅ CRITICAL: Filters out canceled bookings (status: 'canceled')
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
    
    // ✅ CRITICAL: Filter out canceled bookings from availability calculations
    // Canceled bookings should not block time slots
    const activeBookings = (data.bookings || []).filter(booking => booking.status !== 'canceled')
    
    return { success: true, bookings: activeBookings }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return { success: false, bookings: [], error: error.message }
  }
}

/**
 * Get provider-specific availability
 * Uses new public endpoint - returns available slots for a specific provider and date
 */
export const getProviderAvailability = async (providerId, date, slotDuration = 30) => {
  try {
    // Format date as YYYY-MM-DD
    const dateStr = date instanceof Date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : date
    
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_PROVIDER_AVAILABILITY(providerId)}?date=${dateStr}&slotDuration=${slotDuration}`
    
    const response = await fetch(url, {
      headers: {
        'X-Tenant': API_CONFIG.TENANT
      }
      // No credentials needed for public endpoints
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Provider availability endpoint not found for provider ${providerId}`)
        return { success: false, availability: null, error: 'Provider availability endpoint not available' }
      }
      return { success: false, availability: null, error: `Failed to fetch provider availability: ${response.status}` }
    }
    
    const data = await response.json()
    if (!data.success || !data.availability) {
      return { success: false, availability: null, error: data.message || 'Failed to fetch provider availability' }
    }
    
    return { success: true, availability: data.availability }
  } catch (error) {
    console.error('Error fetching provider availability:', error)
    return { success: false, availability: null, error: error.message }
  }
}

/**
 * Get booking settings (including opening hours)
 * Uses public endpoint - no authentication required
 */
export const getBookingSettings = async () => {
  const defaultSettings = {
    calendarBehavior: {
      startTime: '09:00',
      endTime: '17:00',
      timeSlotInterval: 30
    }
  }
  
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKING_SETTINGS_PUBLIC}`, {
      headers: {
        'X-Tenant': API_CONFIG.TENANT
      }
      // No credentials needed for public endpoints
    })
    
    if (!response.ok) {
      // If public endpoint returns error, log and use defaults
      if (response.status === 404) {
        console.warn('⚠️ Public booking settings endpoint not found. Using default opening hours (09:00-17:00).')
      } else {
        console.warn(`⚠️ Failed to fetch booking settings (${response.status}). Using default opening hours (09:00-17:00).`)
      }
      return { 
        success: true, 
        settings: defaultSettings,
        usingDefaults: true
      }
    }
    
    const data = await response.json()
    if (data.success && data.settings) {
      console.log('✅ Fetched booking settings from public endpoint')
      return { success: true, settings: data.settings, usingDefaults: false }
    }
    
    // If response doesn't have expected structure, use defaults
    return { 
      success: true, 
      settings: defaultSettings,
      usingDefaults: true
    }
  } catch (error) {
    // Network error or other issue - use defaults
    console.warn('⚠️ Error fetching booking settings:', error.message)
    return { 
      success: true, 
      settings: defaultSettings,
      usingDefaults: true
    }
  }
}

