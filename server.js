import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Stripe from 'stripe'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const BACKEND_URL = process.env.VITE_API_URL || 'https://source-database.onrender.com'

// Tenant identifier (must match exactly with customer portal database)
// Used for abandoned cart tracking and multi-tenant isolation
const TENANT = process.env.CUSTOMER_PORTAL_TENANT || 'glowhairdressing'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
})

// Store backend session cookies (for CSRF token validation)
// Key: session identifier, Value: cookie string
let backendSessionCookies = null

// Middleware to parse JSON (except for webhooks which need raw body)
app.use((req, res, next) => {
  if (req.path === '/api/webhooks/stripe') {
    return next() // Skip JSON parsing for webhooks
  }
  express.json()(req, res, next)
})

// Create Stripe checkout session endpoint (must be BEFORE proxy route)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { lineItems, successUrl, cancelUrl, customerEmail, productId, mode } = req.body

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'Line items are required' })
    }

    // Determine checkout mode: 'subscription' for recurring prices, 'payment' for one-time
    // If mode is explicitly provided, use it; otherwise check the price type
    let checkoutMode = mode || 'payment'
    
    // If mode not provided, check if price is recurring by retrieving it from Stripe
    if (!mode && lineItems.length > 0) {
      try {
        const price = await stripe.prices.retrieve(lineItems[0].price)
        if (price.type === 'recurring') {
          checkoutMode = 'subscription'
        }
      } catch (priceError) {
        console.warn('Could not retrieve price to determine type, defaulting to payment mode:', priceError.message)
        // Default to payment mode if we can't check
      }
    }

    // Build metadata
    // ✅ CRITICAL: Include tenant in metadata for abandoned cart tracking
    // This enables automatic tracking of checkout sessions and abandoned carts
    // See: ABANDONED_CARTS_TENANT_IMPLEMENTATION.md
    const metadata = {
      tenant: TENANT // ✅ Must match database tenant exactly (case-sensitive)
    }
    
    // Add productId to metadata if provided (for subscriptions or products)
    if (productId) {
      metadata.productId = productId
    }

    // 🔍 DEBUG: Log checkout session creation with tenant metadata
    console.log('🛒 [ABANDONED CART] Creating checkout session with metadata:', {
      tenant: metadata.tenant,
      productId: metadata.productId || 'none',
      mode: checkoutMode,
      lineItemsCount: lineItems.length,
      customerEmail: customerEmail || 'none'
    })

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems.map(item => ({
        price: item.price,
        quantity: item.quantity
      })),
      mode: checkoutMode, // ✅ Use 'subscription' for recurring prices, 'payment' for one-time
      success_url: successUrl || `${req.protocol}://${req.get('host')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/checkout/cancel`,
      customer_email: customerEmail,
      // ✅ Samla in telefonnummer
      phone_number_collection: {
        enabled: true
      },
      // ✅ Samla in leveransadress
      shipping_address_collection: {
        allowed_countries: ['SE', 'NO', 'DK', 'FI']
      },
      metadata: metadata
    })

    // 🔍 DEBUG: Log successful session creation
    console.log(`✅ [ABANDONED CART] Created ${checkoutMode} checkout session:`, {
      sessionId: session.id,
      url: session.url,
      tenant: metadata.tenant,
      metadata: session.metadata,
      createdAt: new Date().toISOString()
    })

    // ✅ CRITICAL: Register checkout session for abandoned cart tracking
    // This MUST be done immediately after creating the session
    // See: ABANDONED_CARTS_TENANT_IMPLEMENTATION.md
    try {
      console.log('🛒 [ABANDONED CART] Registering session with customer portal:', session.id)
      
      const trackPayload = {
        sessionId: session.id,
        tenant: metadata.tenant,
        amountTotal: session.amount_total || 0,
        currency: session.currency || 'SEK',
        customerEmail: session.customer_email || null,
        customerName: session.customer_details?.name || null,
        createdAt: session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString()
      }

      const trackResponse = await fetch(`${BACKEND_URL}/api/carts/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': metadata.tenant
        },
        body: JSON.stringify(trackPayload)
      })

      if (!trackResponse.ok) {
        const errorText = await trackResponse.text()
        throw new Error(`HTTP ${trackResponse.status}: ${errorText}`)
      }

      const trackResult = await trackResponse.json()
      
      if (trackResult.success) {
        console.log('✅ [ABANDONED CART] Session registered successfully:', {
          sessionId: session.id,
          tenant: metadata.tenant,
          recordId: trackResult.recordId,
          status: trackResult.status
        })
      } else {
        console.error('❌ [ABANDONED CART] Failed to register session:', trackResult.message)
      }
    } catch (error) {
      console.error('❌ [ABANDONED CART] Error registering session:', error)
      // Fortsätt ändå - detta är inte kritiskt för checkout flow
      // Session kommer ändå fungera, men abandoned cart tracking fungerar inte
    }
    
    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: error.message || 'Failed to create checkout session' })
  }
})

// Stripe webhook handler for payment events (must be BEFORE proxy route)
// Note: This route must use express.raw() to get the raw body for signature verification
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set, skipping webhook verification')
    return res.status(400).json({ error: 'Webhook secret not configured' })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    try {
      console.log('📦 Processing checkout.session.completed:', session.id)
      
      // Get full session details with expanded line items
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'line_items.data.price.product', 'payment_intent', 'payment_intent.charges']
      })

      // Get line items data
      const lineItems = fullSession.line_items?.data || []
      const firstLineItem = lineItems[0]
      
      // Get payment intent details
      let cardBrand = ''
      let cardLast4 = ''
      
      // Try to get card details from payment intent
      if (fullSession.payment_intent) {
        const paymentIntentId = typeof fullSession.payment_intent === 'string' 
          ? fullSession.payment_intent 
          : fullSession.payment_intent.id
        
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['charges.data.payment_method_details']
          })
          
          if (paymentIntent.charges?.data && paymentIntent.charges.data.length > 0) {
            const charge = paymentIntent.charges.data[0]
            cardBrand = charge.payment_method_details?.card?.brand || ''
            cardLast4 = charge.payment_method_details?.card?.last4 || ''
          }
        } catch (err) {
          console.warn('Could not retrieve payment intent details:', err.message)
        }
      }

      // Build payment data with exact structure expected by customer portal
      // ✅ Event type MUST be exactly 'customer_payment' (case-sensitive)
      // ✅ Amount MUST be in cents (Stripe's amount_total is already in cents)
      // ✅ Data object is required with all fields
      const paymentData = {
        event: 'customer_payment', // ✅ MUST be exactly 'customer_payment'
        tenant: 'glowhairdressing', // ✅ Must match database tenant exactly (lowercase, no spaces)
        data: {
          // ✅ REQUIRED FIELDS
          sessionId: fullSession.id,
          amount: fullSession.amount_total || 0, // ✅ Amount in cents (Stripe provides this)
          currency: fullSession.currency || 'SEK', // ✅ Default to SEK
          customerEmail: fullSession.customer_details?.email || fullSession.customer_email || '',
          customerName: fullSession.customer_details?.name || '',
          status: fullSession.payment_status === 'paid' ? 'completed' : 'open',
          timestamp: new Date(fullSession.created * 1000).toISOString(),
          
          // ✅ RECOMMENDED FIELDS
          productId: fullSession.metadata?.productId || '', // ✅ Get from metadata first
          priceId: firstLineItem?.price?.id || '',
          productName: firstLineItem?.description || firstLineItem?.price?.nickname || '',
          quantity: firstLineItem?.quantity || 1,
          paymentMethod: 'card',
          
          // ✅ OPTIONAL FIELDS (if available)
          cardBrand: cardBrand,
          cardLast4: cardLast4
        }
      }

      // ✅ ADD DETAILED LOGGING FOR DEBUGGING
      console.log('📤 Processing payment for session:', fullSession.id)
      console.log('📤 Amount:', fullSession.amount_total, 'cents')
      console.log('📤 Customer:', fullSession.customer_details?.email || fullSession.customer_email)
      console.log('📤 Sending payment payload:', JSON.stringify(paymentData, null, 2))
      console.log('📤 Event type:', paymentData.event)
      console.log('📤 Has data object:', !!paymentData.data)
      console.log('📤 Data keys:', paymentData.data ? Object.keys(paymentData.data) : 'NO DATA')
      console.log('📤 Required fields check:', {
        hasSessionId: !!paymentData.data.sessionId,
        hasAmount: !!paymentData.data.amount,
        hasCustomerEmail: !!paymentData.data.customerEmail,
        hasStatus: !!paymentData.data.status,
        hasTimestamp: !!paymentData.data.timestamp
      })

      const portalResponse = await fetch(`${BACKEND_URL}/api/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': 'glowhairdressing' // ✅ Must match database tenant exactly
        },
        body: JSON.stringify(paymentData)
      })

      const responseData = await portalResponse.json()
      
      if (portalResponse.ok && responseData.success) {
        console.log('✅ Payment sent to customer portal:', responseData)
        console.log('💳 Payment should appear in Betalningar section now')
        console.log('✅ Portal response success:', responseData.success)
      } else {
        console.error('❌ Payment not saved:', {
          status: portalResponse.status,
          statusText: portalResponse.statusText,
          response: responseData
        })
        console.error('❌ Payment payload that failed:', JSON.stringify(paymentData, null, 2))
        console.error('❌ Check if event type is exactly "customer_payment"')
        console.error('❌ Check if data object has all required fields')
      }
    } catch (error) {
      console.error('❌ Error processing payment webhook:', error)
      console.error('Error stack:', error.stack)
    }
  }

  res.json({ received: true })
})

// CORS headers for API proxy
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Tenant, X-CSRF-Token, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Proxy API requests to backend (catches all /api routes not handled above)
app.use('/api', async (req, res) => {
  try {
    // req.path already has the path without /api (e.g., /stripe/checkout)
    // We need to add /api prefix when forwarding to backend
    const backendPath = `/api${req.path}`
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''
    const url = `${BACKEND_URL}${backendPath}${queryString}`
    
    console.log(`Proxying ${req.method} ${url}`)
    console.log('Request headers:', {
      'x-tenant': req.headers['x-tenant'],
      'x-csrf-token': req.headers['x-csrf-token'] ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    })
    
    // Check if this is a public booking endpoint
    const isPublicBookingEndpoint = req.path.includes('/system/booking/public/')
    // For POST requests, we still need cookies for CSRF validation even for public endpoints
    const isPublicBookingPOST = isPublicBookingEndpoint && req.method === 'POST'
    
    // Check if this is an analytics events endpoint (uses API key auth, not CSRF)
    const isAnalyticsEventsEndpoint = req.path === '/analytics/events'
    
    const options = {
      method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant': req.headers['x-tenant'] || 'glowhairdressing' // ✅ Default to database tenant
          }
    }
    
    // Add API key authentication for analytics events endpoint
    if (isAnalyticsEventsEndpoint && process.env.ANALYTICS_API_KEY) {
      options.headers['Authorization'] = `Bearer ${process.env.ANALYTICS_API_KEY}`
      console.log('Using API key authentication for analytics events endpoint')
    }
    
    // Forward cookies for:
    // 1. Non-public endpoints (authentication required)
    // 2. Public booking POST endpoints (CSRF validation requires cookies)
    // 3. Skip for analytics events endpoint (uses API key auth instead)
    if ((!isPublicBookingEndpoint || isPublicBookingPOST) && !isAnalyticsEventsEndpoint) {
      // Forward cookies from the original request (important for CSRF token validation)
      if (req.headers.cookie) {
        options.headers['Cookie'] = req.headers.cookie
        console.log('Forwarding client cookies to backend:', req.headers.cookie.substring(0, 50) + '...')
      } else if (backendSessionCookies) {
        // Use stored backend session cookies (established from CSRF token fetch)
        options.headers['Cookie'] = backendSessionCookies
        console.log('Using stored backend session cookies:', backendSessionCookies.substring(0, 50) + '...')
      } else {
        if (isPublicBookingPOST) {
          console.warn('No cookies available for public POST - CSRF validation may fail!')
        } else {
          console.warn('No cookies available - this may cause CSRF validation to fail!')
        }
      }
    } else if (isAnalyticsEventsEndpoint) {
      // Analytics events endpoint - no cookies needed (uses API key auth)
      console.log('Analytics events endpoint - skipping cookie forwarding (using API key auth)')
    } else {
      // Public booking GET endpoints - no cookies needed
      console.log('Public booking GET endpoint - skipping cookie forwarding')
    }
    
    // Forward CSRF token if present (only for POST/PUT/DELETE, and not for public GET endpoints or analytics events)
    // Public booking GET endpoints and analytics events endpoint don't need CSRF token
    if (req.headers['x-csrf-token'] && (!isPublicBookingEndpoint || req.method !== 'GET') && !isAnalyticsEventsEndpoint) {
      options.headers['X-CSRF-Token'] = req.headers['x-csrf-token']
      console.log('Including CSRF token in backend request:', req.headers['x-csrf-token'].substring(0, 20) + '...')
    } else if (req.method !== 'GET' && !isPublicBookingEndpoint && !isAnalyticsEventsEndpoint) {
      console.warn('CSRF token missing in request headers!')
    }
    
    console.log('Headers being sent to backend:', {
      'X-Tenant': options.headers['X-Tenant'],
      'X-CSRF-Token': options.headers['X-CSRF-Token'] ? (options.headers['X-CSRF-Token'].substring(0, 20) + '...') : 'missing',
      'Authorization': options.headers['Authorization'] ? (options.headers['Authorization'].substring(0, 20) + '...') : 'missing',
      'Cookie': options.headers['Cookie'] ? (options.headers['Cookie'].substring(0, 50) + '...') : 'missing',
      'Content-Type': options.headers['Content-Type']
    })
    
    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body)
    }
    
    // Make the request to backend
    const response = await fetch(url, options)
    
    // Log response status and set-cookie headers for debugging
    console.log(`Backend response: ${response.status} ${response.statusText} for ${req.method} ${url}`)
    
    // Check if backend is setting cookies (for session management)
    // Note: response.headers.get('set-cookie') might only return first cookie
    // We need to get all Set-Cookie headers
    const setCookieHeaders = []
    
    // Try to get all set-cookie headers (Node.js fetch might return as array or comma-separated)
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      // If it's already an array, use it directly
      if (Array.isArray(setCookieHeader)) {
        setCookieHeaders.push(...setCookieHeader)
      } else {
        // If it's a string, it might contain multiple cookies separated by commas
        // But actually, each Set-Cookie header is separate, so we need to check headers.raw()
        setCookieHeaders.push(setCookieHeader)
      }
    }
    
    // Also check headers.raw() for all set-cookie headers (Node.js fetch API)
    try {
      const rawHeaders = response.headers.raw()
      if (rawHeaders['set-cookie']) {
        setCookieHeaders.push(...rawHeaders['set-cookie'])
      }
    } catch (e) {
      // headers.raw() might not be available in all environments
    }
    
    if (setCookieHeaders.length > 0) {
      console.log('Backend is setting cookies:', setCookieHeaders.join(' | ').substring(0, 300) + '...')
      
      // Extract cookie name=value pairs from each Set-Cookie header
      const cookies = []
      for (const cookieHeader of setCookieHeaders) {
        // Extract cookie name=value (everything before the first semicolon)
        const match = cookieHeader.match(/([^=]+=[^;]+)/)
        if (match) {
          cookies.push(match[1])
        }
      }
      
      // Combine all cookies into a single Cookie header string
      if (cookies.length > 0) {
        // Merge with existing cookies if any
        // Use a Map to handle duplicate cookie names (keep latest value)
        const cookieMap = new Map()
        
        // First, add existing cookies
        if (backendSessionCookies) {
          const existingCookies = backendSessionCookies.split('; ').map(c => c.trim())
          for (const cookie of existingCookies) {
            const [name] = cookie.split('=')
            if (name) {
              cookieMap.set(name, cookie)
            }
          }
        }
        
        // Then, add/update with new cookies (newer values override older ones)
        for (const cookie of cookies) {
          const [name] = cookie.split('=')
          if (name) {
            cookieMap.set(name, cookie) // This will override if name already exists
          }
        }
        
        // Convert map back to cookie string
        backendSessionCookies = Array.from(cookieMap.values()).join('; ')
        console.log('Stored backend session cookies for future requests:', backendSessionCookies.substring(0, 150) + '...')
      }
      
      // Note: We can't forward Set-Cookie headers to the client due to domain mismatch
      // The backend sets cookies for source-database.onrender.com, but client is on glow-test.onrender.com
      // So we store them in the proxy and reuse them for backend requests
    }
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type') || ''
    let data
    
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
        console.log(`Backend JSON response for ${req.path}:`, JSON.stringify(data).substring(0, 200))
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError)
        const text = await response.text()
        console.error('Response text:', text.substring(0, 200))
        return res.status(500).json({ 
          success: false,
          error: 'Invalid JSON response from backend',
          message: 'Backend returned non-JSON response',
          status: response.status
        })
      }
    } else {
      // Non-JSON response (likely HTML error page)
      const text = await response.text()
      console.error(`Backend returned non-JSON (${contentType}) for ${req.path}:`, text.substring(0, 300))
      return res.status(response.status || 500).json({
        success: false,
        error: `Backend error: ${response.status} ${response.statusText}`,
        message: response.status === 403 
          ? 'Access forbidden. The endpoint may require authentication or the backend may not have implemented this endpoint yet.'
          : response.status === 404
          ? 'Endpoint not found. The backend may not have implemented this endpoint yet.'
          : 'The backend service returned an error. Please check if the endpoint exists.',
        status: response.status
      })
    }
    
    // Forward the response (including error responses from backend)
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Proxy error:', error.message)
    res.status(500).json({ 
      success: false,
      error: 'Backend service unavailable',
      message: error.message
    })
  }
})

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')))

// Serve React app for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Proxying API requests to: ${BACKEND_URL}`)
})

