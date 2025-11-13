import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const BACKEND_URL = process.env.VITE_API_URL || 'https://source-database.onrender.com'

// Store backend session cookies (for CSRF token validation)
// Key: session identifier, Value: cookie string
let backendSessionCookies = null

// Middleware to parse JSON
app.use(express.json())

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

// Proxy API requests to backend
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
    
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': req.headers['x-tenant'] || 'hairdresser'
      },
      // Forward cookies from the original request (important for CSRF token validation)
      credentials: 'include'
    }
    
    // Forward cookies from the original request OR use stored backend session cookies
    if (req.headers.cookie) {
      options.headers['Cookie'] = req.headers.cookie
      console.log('Forwarding client cookies to backend:', req.headers.cookie.substring(0, 50) + '...')
    } else if (backendSessionCookies) {
      // Use stored backend session cookies (established from CSRF token fetch)
      options.headers['Cookie'] = backendSessionCookies
      console.log('Using stored backend session cookies:', backendSessionCookies.substring(0, 50) + '...')
    } else {
      console.warn('No cookies available - this may cause CSRF validation to fail!')
    }
    
    // Forward CSRF token if present (Express normalizes headers to lowercase)
    if (req.headers['x-csrf-token']) {
      options.headers['X-CSRF-Token'] = req.headers['x-csrf-token']
      console.log('Including CSRF token in backend request:', req.headers['x-csrf-token'].substring(0, 20) + '...')
    } else {
      console.warn('CSRF token missing in request headers!')
    }
    
    console.log('Headers being sent to backend:', {
      'X-Tenant': options.headers['X-Tenant'],
      'X-CSRF-Token': options.headers['X-CSRF-Token'] ? (options.headers['X-CSRF-Token'].substring(0, 20) + '...') : 'missing',
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
        if (backendSessionCookies) {
          const existingCookies = backendSessionCookies.split('; ').map(c => c.trim())
          const allCookies = [...new Set([...existingCookies, ...cookies])] // Remove duplicates
          backendSessionCookies = allCookies.join('; ')
        } else {
          backendSessionCookies = cookies.join('; ')
        }
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

