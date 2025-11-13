import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const BACKEND_URL = process.env.VITE_API_URL || 'https://source-database.onrender.com'

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
      }
    }
    
    // Forward CSRF token if present (Express normalizes headers to lowercase)
    if (req.headers['x-csrf-token']) {
      options.headers['X-CSRF-Token'] = req.headers['x-csrf-token']
      console.log('Including CSRF token in backend request:', req.headers['x-csrf-token'].substring(0, 20) + '...')
      console.log('Full headers being sent to backend:', JSON.stringify(options.headers, null, 2))
    } else {
      console.warn('CSRF token missing in request headers!')
    }
    
    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body)
    }
    
    const response = await fetch(url, options)
    
    // Log response status for debugging
    console.log(`Backend response: ${response.status} ${response.statusText} for ${req.method} ${url}`)
    
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

