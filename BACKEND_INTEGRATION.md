# Backend Integration Guide for Glow Website

This document describes how the Glow hairdresser website integrates with the backend customer portal.

## Overview

The Glow website sends data to the backend API for:
- **Appointments/Bookings** - When customers book appointments
- **Contact Messages** - When customers submit the contact form
- **Subscriptions** - When customers subscribe to packages
- **Analytics** - Page views and user interactions

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Backend API base URL
# Note: Vite requires VITE_ prefix for environment variables exposed to client
VITE_API_URL=https://source-database.onrender.com
```

### API Configuration

The API configuration is located in `src/config/api.js`:

- **Tenant**: `hairdresser` (hardcoded for Glow)
- **Base URL**: Set via `VITE_API_URL` environment variable (or defaults to `https://source-database.onrender.com`)
- **CSRF Protection**: Automatically handled via token fetching

**Important**: Vite uses `import.meta.env` instead of `process.env` for environment variables. Only variables prefixed with `VITE_` are exposed to the client code.

## API Endpoints

### 1. Book Appointment

**Endpoint**: `POST /api/messages` ✅ (public endpoint, no authentication required)

**Payload**:
```json
{
  "tenant": "hairdresser",
  "name": "Anna Andersson",
  "email": "anna@example.com",
  "phone": "+46701234567",
  "subject": "Bokning",
  "message": "Bokning begärd:\n\nTjänst: Hårklippning\nDatum: 2025-01-20 10:00\nTelefon: +46701234567",
  "company": ""
}
```

**Usage**: Called from `BookNow` component when customer submits booking form.

**Note**: Uses `/api/messages` endpoint (public, no authentication). The `subject` field is set to `"Bokning"` to identify appointment requests. All appointment details are formatted in the `message` field. The `company` field is a honeypot (must be empty).

---

### 2. Send Contact Message

**Endpoint**: `POST /api/messages` ✅ (public endpoint, no authentication required)

**Payload**:
```json
{
  "tenant": "hairdresser",
  "name": "Anna Andersson",
  "email": "anna@example.com",
  "phone": "+46701234567",
  "subject": "Kontaktformulär",
  "message": "I would like to book an appointment...",
  "company": ""
}
```

**Usage**: Called from `Contact` component when customer submits contact form.

**Note**: The `subject` field is set to `"Kontaktformulär"` to identify general contact messages. The `company` field is a honeypot (must be empty) to prevent spam.

---

### 3. Subscribe to Package

**Endpoint**: `POST /api/messages` ✅ (public endpoint, no authentication required)

**Payload**:
```json
{
  "tenant": "hairdresser",
  "name": "Anna Andersson",
  "email": "anna@example.com",
  "phone": "+46701234567",
  "subject": "Prenumeration",
  "message": "Prenumerationsintresse:\n\nPaket: Basic\nPris: 89 SEK\nPeriod: per 3 months",
  "company": ""
}
```

**Usage**: Called from `JoinUs` component when customer subscribes to a package.

**Note**: Uses `/api/messages` endpoint (public, no authentication). The `subject` field is set to `"Prenumeration"` to identify subscription requests. All subscription details are formatted in the `message` field. The `company` field is a honeypot (must be empty).

---

### 4. Track Analytics Event

**Endpoint**: `POST /api/analytics/track` ✅ (CSRF protection skipped)

**Payload**:
```json
{
  "event": "page_view",
  "tenant": "hairdresser",
  "data": {
    "page": "/about",
    "referrer": "https://google.com",
    "sessionId": "sess_abc123",
    "timestamp": "2025-01-20T10:00:00.000Z"
  }
}
```

**Usage**: Automatically called on page navigation via `PageTracker` component.

**Note**: Analytics tracking is fire-and-forget and doesn't require CSRF protection. Errors are silently logged to avoid disrupting user experience.

---

## CSRF Protection

All POST/PUT/DELETE requests automatically include CSRF token:

1. Token is fetched from `/api/auth/csrf` endpoint
2. Token is included in `X-CSRF-Token` header
3. Token can also be read from `<meta name="csrf-token">` tag

## Headers

All API requests include:

- `Content-Type: application/json`
- `X-Tenant: hairdresser` (tenant identifier)
- `X-CSRF-Token: <token>` (for POST/PUT/DELETE requests)
- `credentials: include` (for session cookies)

## Error Handling

All API functions return:

```javascript
{
  success: true/false,
  data: {...},      // if success
  error: "message"  // if failure
}
```

Components handle errors by:
- Showing alert messages to users
- Logging errors to console
- Resetting forms on success

## Testing

To test the integration:

1. Create a `.env` file in the root directory with `VITE_API_URL=https://source-database.onrender.com`
2. Start the development server: `npm run dev`
3. Submit forms on the website
4. Check browser console for API calls
5. Verify data appears in backend customer portal

**Note**: After creating or updating the `.env` file, you may need to restart the development server for changes to take effect.

## Backend Requirements

### Existing Endpoints (Ready to Use) ✅

- `POST /api/messages` - Create message (used for all public forms: appointments, subscriptions, contact) ✅
  - **Public endpoint** - No authentication required
  - **CSRF protected** - Requires CSRF token
  - **Rate limited** - 50 requests per 5 minutes
  - Uses `subject` field to differentiate:
    - `"Bokning"` for appointments
    - `"Prenumeration"` for subscriptions
    - `"Kontaktformulär"` for general contact
- `POST /api/analytics/track` - Track analytics event ✅ (CSRF skipped)
- `GET /api/auth/csrf` - Get CSRF token ✅

### Why Not Use `/api/leads`?

The `/api/leads` endpoint requires authentication (`requireAuth` middleware), but all forms on the Glow website are public (no login required). Using `/api/messages` allows public forms to work without authentication while still being protected by CSRF tokens and rate limiting.

### Future Improvements

When dedicated endpoints are created, the implementation can be easily updated by:
1. Adding the new endpoints to `src/config/api.js`
2. Updating the payload structure in `src/services/api.js`
3. No changes needed in components (they use the service functions)

### Endpoint Requirements

All endpoints should:
- Accept `X-Tenant` header
- Validate CSRF token (except analytics)
- Filter data by tenant
- Return JSON responses with `{ success: true/false, ... }` format

## Files Modified

- `src/config/api.js` - API configuration
- `src/services/api.js` - API service functions
- `src/components/BookNow.jsx` - Integrated booking API
- `src/components/Contact.jsx` - Integrated contact API
- `src/components/JoinUs.jsx` - Integrated subscription API
- `src/App.jsx` - Added analytics tracking
- `index.html` - Added CSRF meta tag

## Support

For backend integration questions, refer to the backend integration guide provided by the customer portal team.

