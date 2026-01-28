import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Stripe from 'stripe'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const BACKEND_URL = process.env.VITE_API_URL || 'https://source-database-809785351172.europe-north1.run.app'

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

// Rewrites backend Set-Cookie headers so the browser can store them on the Glow domain.
const sanitizeCookieForClient = (cookieHeader) => {
  if (!cookieHeader) return null

  const parts = cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return null
  }

  const [nameValue, ...attributes] = parts

  // Remove Domain attribute so cookie is scoped to the Glow host
  const filteredAttrs = attributes.filter(attr => !attr.toLowerCase().startsWith('domain='))

  // Ensure the cookie is sent for all routes
  const hasPath = filteredAttrs.some(attr => attr.toLowerCase().startsWith('path='))
  if (!hasPath) {
    filteredAttrs.push('Path=/')
  }

  return [nameValue, ...filteredAttrs].join('; ')
}

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

// Stripe Connect Checkout Endpoint (Tenant Backend)
// This endpoint handles inventory validation, campaign price checking, gift card handling,
// and forwards to Source Portal backend endpoint /storefront/{tenant}/checkout
// See: Backend_Implementation_for_New_Customers.md - Stripe Connect Implementation
app.post('/api/checkout', async (req, res) => {
  try {
    const {
      items,
      customerEmail,
      successUrl,
      cancelUrl,
      giftCardCode,
      metadata: requestMetadata = {}
    } = req.body

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Items are required' 
      })
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ 
        success: false,
        error: 'successUrl and cancelUrl are required' 
      })
    }

    console.log('🛒 [STRIPE CONNECT] Checkout request received:', {
      itemsCount: items.length,
      hasGiftCardCode: !!giftCardCode,
      tenant: TENANT
    })

    // Extract gift card code (from direct property or metadata)
    const giftCardCodeToUse = giftCardCode || requestMetadata.giftCardCode

    // Validate gift card code format if provided
    if (giftCardCodeToUse && typeof giftCardCodeToUse !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid gift card code format' 
      })
    }

    // Step 1: Validate inventory for each product (skip gift cards)
    for (const item of items) {
      // Skip inventory check for gift cards
      if (item.type === 'gift_card') continue

      // Check inventory via public API endpoint
      if (item.productId) {
        try {
          const inventoryUrl = `${BACKEND_URL}/api/inventory/public/${TENANT}/${item.productId}`
          const inventoryResponse = await fetch(inventoryUrl, {
            headers: {
              'X-Tenant': TENANT
            }
          })

          if (inventoryResponse.ok) {
            const inventoryData = await inventoryResponse.json()
            
            if (inventoryData.success && inventoryData.found && inventoryData.inventory) {
              const inventory = inventoryData.inventory
              
              // Check if product is out of stock
              if (inventory.outOfStock || inventory.status === 'out_of_stock') {
                return res.status(400).json({
                  success: false,
                  error: `Product ${inventory.name || item.productId} is out of stock`
                })
              }

              // Check if quantity exceeds available stock
              if (inventory.stock !== null && inventory.stock < item.quantity) {
                return res.status(400).json({
                  success: false,
                  error: `Insufficient stock for ${inventory.name || item.productId}. Available: ${inventory.stock}, Requested: ${item.quantity}`
                })
              }
            }
          }
        } catch (inventoryError) {
          console.warn('⚠️ [STRIPE CONNECT] Inventory check failed (continuing anyway):', inventoryError.message)
          // Continue with checkout even if inventory check fails (graceful degradation)
        }
      }
    }

    // Step 2: Check campaign prices and build backend items
    const backendItems = await Promise.all(
      items.map(async (item, index) => {
        let priceId = item.stripePriceId
        
        // Log the price ID we received from frontend
        console.log('🔍 [STRIPE CONNECT] Processing item:', {
          variantKey: item.variantKey,
          productId: item.productId,
          receivedPriceId: item.stripePriceId,
          quantity: item.quantity
        })

        // Check campaign price if productId is available
        if (item.productId && item.stripePriceId) {
          try {
            // Get Stripe Product ID from Storefront API if needed
            let apiProductId = item.productId
            
            // Try to get product from storefront API to get stripeProductId
            try {
              const productUrl = `${BACKEND_URL}/storefront/${TENANT}/product/${item.productId}`
              const productResponse = await fetch(productUrl, {
                headers: {
                  'X-Tenant': TENANT
                }
              })

              if (productResponse.ok) {
                const productData = await productResponse.json()
                if (productData.success && productData.product?.stripeProductId) {
                  apiProductId = productData.product.stripeProductId
                }
              }
            } catch (productError) {
              console.warn('⚠️ [STRIPE CONNECT] Could not fetch product details, using productId:', productError.message)
            }

            // Check campaign price from Source Portal API
            const campaignUrl = `${BACKEND_URL}/api/campaigns/price/${apiProductId}?originalPriceId=${encodeURIComponent(item.stripePriceId)}&tenant=${TENANT}`
            const campaignResponse = await fetch(campaignUrl, {
              headers: {
                'X-Tenant': TENANT,
                'Content-Type': 'application/json'
              },
              cache: 'no-store'
            })

            if (campaignResponse.ok) {
              const campaignData = await campaignResponse.json()
              
              if (campaignData.hasCampaignPrice && campaignData.priceId) {
                // Use campaign price
                priceId = campaignData.priceId
                console.log(`✅ [STRIPE CONNECT] Using campaign price for product ${item.productId}:`, {
                  originalPriceId: item.stripePriceId,
                  campaignPriceId: priceId,
                  campaignName: campaignData.campaignName
                })
              }
            }
          } catch (campaignError) {
            console.warn('⚠️ [STRIPE CONNECT] Campaign price check failed (using original price):', campaignError.message)
            // Continue with original price if campaign check fails
          }
        }

        // Log the final price ID being sent to backend
        console.log('📤 [STRIPE CONNECT] Final item for backend:', {
          variantId: item.variantKey || item.productId || `fallback-${index}`,
          quantity: item.quantity,
          stripePriceId: priceId,
          priceIdChanged: priceId !== item.stripePriceId,
          originalPriceId: item.stripePriceId
        })
        
        return {
          variantId: item.variantKey || item.productId || `fallback-${index}`, // variantKey || productId || fallback
          quantity: item.quantity,
          stripePriceId: priceId
        }
      })
    )

    // Step 3: Build metadata for backend request
    const sessionMetadata = {
      tenant: TENANT, // ✅ Tenant ID from environment variable
      source: 'tenant_website', // ✅ Source identifier
      website: req.get('host') || 'glowhairdressing.se', // ✅ Website domain
      ...requestMetadata // Include any additional metadata from frontend
    }

    // Step 4: Handle gift card purchase metadata
    const giftCardItem = items.find(item => item.type === 'gift_card')
    const isGiftCardPurchase = !!giftCardItem

    if (isGiftCardPurchase && giftCardItem) {
      // Convert from cents to SEK
      const giftCardAmountInMajorUnits = giftCardItem.giftCardAmount 
        ? Math.round(giftCardItem.giftCardAmount / 100).toString() 
        : '0'
      
      sessionMetadata.product_type = 'giftcard'
      sessionMetadata.giftcard_amount = giftCardAmountInMajorUnits
      sessionMetadata.giftcard_currency = 'SEK'
      sessionMetadata.source = 'tenant_webshop' // Override source for gift cards
    }

    // Step 5: Include gift card code in metadata if present
    if (giftCardCodeToUse) {
      sessionMetadata.giftCardCode = giftCardCodeToUse
      console.log(`🎁 [STRIPE CONNECT] Forwarding gift card code in metadata: ${giftCardCodeToUse.substring(0, 4)}****`)
    }

    // Step 6: Build backend request body
    const backendRequestBody = {
      items: backendItems,
      customerEmail: customerEmail || undefined,
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      ...(giftCardCodeToUse && { giftCardCode: giftCardCodeToUse }), // Explicitly include if present
      metadata: sessionMetadata
    }

    console.log('📤 [STRIPE CONNECT] Forwarding to Source Portal backend:', {
      itemsCount: backendItems.length,
      hasGiftCardCode: !!giftCardCodeToUse,
      tenant: TENANT
    })

    // Step 7: Call Source Portal backend endpoint
    const backendCheckoutUrl = `${BACKEND_URL}/storefront/${TENANT}/checkout`
    const backendResponse = await fetch(backendCheckoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': TENANT
      },
      body: JSON.stringify(backendRequestBody)
    })

    // Check content type before parsing
    const contentType = backendResponse.headers.get('content-type') || ''
    let backendData
    
    if (contentType.includes('application/json')) {
      try {
        backendData = await backendResponse.json()
      } catch (parseError) {
        const errorText = await backendResponse.text()
        console.error('❌ [STRIPE CONNECT] Failed to parse backend JSON response:', parseError)
        console.error('❌ [STRIPE CONNECT] Backend response text:', errorText.substring(0, 500))
        return res.status(backendResponse.status).json({
          success: false,
          error: 'Invalid response from checkout service'
        })
      }
    } else {
      const errorText = await backendResponse.text()
      console.error('❌ [STRIPE CONNECT] Backend returned non-JSON response:', {
        status: backendResponse.status,
        contentType: contentType,
        responsePreview: errorText.substring(0, 500)
      })
      return res.status(backendResponse.status).json({
        success: false,
        error: 'Invalid response from checkout service'
      })
    }

    if (!backendResponse.ok) {
      console.error('❌ [STRIPE CONNECT] Backend checkout failed:', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        error: backendData.error || backendData.message,
        fullResponse: backendData
      })
      
      // Provide more helpful error messages for common issues
      let errorMessage = backendData.error || backendData.message || 'Checkout failed'
      
      // Check for Stripe Connect onboarding errors
      if (errorMessage.includes('aktiverat kortbetalningar') || 
          errorMessage.includes('onboarding') ||
          errorMessage.includes('card payments')) {
        console.error('⚠️ [STRIPE CONNECT] Onboarding issue detected:', {
          error: errorMessage,
          suggestion: 'The Stripe Connect account needs to complete onboarding in the Stripe Dashboard',
          action: 'Check Integration settings in the customer portal backend'
        })
      }
      
      return res.status(backendResponse.status).json({
        success: false,
        error: errorMessage
      })
    }

    if (!backendData.success || !backendData.checkoutUrl) {
      console.error('❌ [STRIPE CONNECT] Invalid response from backend:', backendData)
      return res.status(500).json({
        success: false,
        error: 'Invalid response from checkout service'
      })
    }

    // Step 8: Register checkout session for abandoned cart tracking
    if (backendData.sessionId) {
      try {
        console.log('🛒 [ABANDONED CART] Registering session with customer portal:', backendData.sessionId)
        
        const trackPayload = {
          sessionId: backendData.sessionId,
          tenant: TENANT,
          amountTotal: backendData.amountTotal || 0,
          currency: backendData.currency || 'SEK',
          customerEmail: customerEmail || null,
          createdAt: new Date().toISOString()
        }

        const trackResponse = await fetch(`${BACKEND_URL}/api/carts/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant': TENANT
          },
          body: JSON.stringify(trackPayload)
        })

        if (trackResponse.ok) {
          const trackResult = await trackResponse.json()
          if (trackResult.success) {
            console.log('✅ [ABANDONED CART] Session registered successfully:', {
              sessionId: backendData.sessionId,
              tenant: TENANT
            })
          }
        }
      } catch (trackError) {
        console.error('❌ [ABANDONED CART] Error registering session:', trackError)
        // Continue anyway - this is not critical for checkout flow
      }
    }

    // Step 9: Return checkout URL to frontend
    console.log('✅ [STRIPE CONNECT] Checkout session created successfully:', {
      sessionId: backendData.sessionId,
      orderId: backendData.orderId
    })

    res.json({
      success: true,
      url: backendData.checkoutUrl,
      checkoutUrl: backendData.checkoutUrl, // Alias for compatibility
      sessionId: backendData.sessionId,
      orderId: backendData.orderId,
      expiresAt: backendData.expiresAt
    })

  } catch (error) {
    console.error('❌ [STRIPE CONNECT] Error processing checkout:', error)
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to create checkout session' 
    })
  }
})

// Gift Card Verification Endpoint (Read-Only)
// See: Backend_Implementation_for_New_Customers.md - Gift Cards section
app.post('/api/gift-cards/verify', async (req, res) => {
  try {
    const { code } = req.body

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Gift card code is required'
      })
    }

    // Format code (uppercase, trimmed)
    const formattedCode = code.toUpperCase().trim()

    console.log('🎁 [GIFT CARD] Verifying gift card code:', formattedCode.substring(0, 4) + '****')

    // Call Source Portal backend gift card verification endpoint
    const verifyUrl = `${BACKEND_URL}/api/storefront/${TENANT}/giftcards/verify`
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': TENANT
      },
      body: JSON.stringify({ code: formattedCode })
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok) {
      return res.status(verifyResponse.status).json({
        success: false,
        valid: false,
        error: verifyData.error || verifyData.message || 'Invalid gift card code'
      })
    }

    if (!verifyData.valid) {
      return res.json({
        success: true,
        valid: false,
        error: verifyData.error || 'Invalid gift card code'
      })
    }

    // Return gift card details
    res.json({
      success: true,
      valid: true,
      balance: verifyData.balance || 0, // Balance in cents
      expiresAt: verifyData.expiresAt || null
    })

  } catch (error) {
    console.error('❌ [GIFT CARD] Error verifying gift card:', error)
    res.status(500).json({
      success: false,
      valid: false,
      error: 'Failed to verify gift card'
    })
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

// CORS headers middleware (must be before routes that need CORS)
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
    console.log('Request path info:', {
      'req.path': req.path,
      'req.url': req.url,
      'req.originalUrl': req.originalUrl
    })
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
    // req.path is the path after the route prefix, so /api/analytics/events becomes /analytics/events
    const isAnalyticsEventsEndpoint = req.path === '/analytics/events'
    
    // Debug logging for analytics events endpoint
    if (isAnalyticsEventsEndpoint) {
      console.log('🔍 [ANALYTICS] Detected analytics events endpoint:', {
        path: req.path,
        method: req.method,
        hasApiKey: !!process.env.ANALYTICS_API_KEY,
        apiKeyPrefix: process.env.ANALYTICS_API_KEY ? process.env.ANALYTICS_API_KEY.substring(0, 10) + '...' : 'NOT SET'
      })
    }
    
    const options = {
      method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant': req.headers['x-tenant'] || 'glowhairdressing' // ✅ Default to database tenant
          }
    }
    
    // Add API key authentication for analytics events endpoint
    if (isAnalyticsEventsEndpoint) {
      if (process.env.ANALYTICS_API_KEY) {
        // Trim whitespace from API key (common issue with environment variables)
        const apiKey = process.env.ANALYTICS_API_KEY.trim()
        
        // Validate API key format (should start with ek_live_ or ek_test_)
        if (!apiKey.startsWith('ek_live_') && !apiKey.startsWith('ek_test_')) {
          console.error('❌ [ANALYTICS] Invalid API key format!')
          console.error('❌ [ANALYTICS] API key should start with "ek_live_" or "ek_test_"')
          console.error('❌ [ANALYTICS] Current key prefix:', apiKey.substring(0, 10))
        }
        
        options.headers['Authorization'] = `Bearer ${apiKey}`
        console.log('✅ [ANALYTICS] Using API key authentication for analytics events endpoint')
        console.log('🔍 [ANALYTICS] API key format check:', {
          startsWithEkLive: apiKey.startsWith('ek_live_'),
          startsWithEkTest: apiKey.startsWith('ek_test_'),
          keyLength: apiKey.length,
          keyPrefix: apiKey.substring(0, 15) + '...'
        })
      } else {
        console.error('❌ [ANALYTICS] ANALYTICS_API_KEY not set in environment variables!')
        console.error('❌ [ANALYTICS] Please set ANALYTICS_API_KEY in Render environment variables')
      }
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
      console.log('✅ [ANALYTICS] Analytics events endpoint - skipping cookie forwarding (using API key auth)')
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
    
    // Special logging for analytics events endpoint errors
    if (isAnalyticsEventsEndpoint && !response.ok) {
      console.error('❌ [ANALYTICS] Backend returned error for analytics events endpoint:', {
        status: response.status,
        statusText: response.statusText,
        url: url,
        hasApiKey: !!options.headers['Authorization'],
        hasTenant: !!options.headers['X-Tenant']
      })
    }
    
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

      const clientCookies = []

      // Extract cookie name=value pairs from each Set-Cookie header
      const cookies = []
      for (const cookieHeader of setCookieHeaders) {
        // Extract cookie name=value (everything before the first semicolon)
        const match = cookieHeader.match(/([^=]+=[^;]+)/)
        if (match) {
          cookies.push(match[1])
        }
        const sanitized = sanitizeCookieForClient(cookieHeader)
        if (sanitized) {
          clientCookies.push(sanitized)
        }
      }

      if (clientCookies.length > 0) {
        res.setHeader('Set-Cookie', clientCookies)
        console.log('Forwarded cookies to client:', clientCookies.map(c => c.split(';')[0]).join(', '))
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
      // The backend sets cookies for source-database-809785351172.europe-north1.run.app, but client is on glow-test.onrender.com
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

