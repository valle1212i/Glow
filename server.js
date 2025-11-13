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
    
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': req.headers['x-tenant'] || 'hairdresser',
        ...(req.headers['x-csrf-token'] && { 'X-CSRF-Token': req.headers['x-csrf-token'] })
      }
    }
    
    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body)
    }
    
    const response = await fetch(url, options)
    const data = await response.json()
    
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).json({ error: 'Backend service unavailable' })
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

