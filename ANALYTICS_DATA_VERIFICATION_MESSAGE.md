# Message to Customer Portal Team - Analytics Events Data Verification

---

**Subject: Analytics Events Endpoint - Data Extraction Verification Request**

Hi Customer Portal Team,

We've successfully integrated the analytics events endpoint (`POST /api/analytics/events`) for geographic tracking on the Glow Hairdressing website. Based on your verification document (ANALYTICS_EVENTS_VERIFICATION.md), the endpoint is implemented and ready. We'd like to confirm that data is being extracted and stored correctly on your side.

## Our Implementation Status

✅ **Frontend Integration Complete:**
- Geographic tracking implemented with user consent
- Events sent to `/api/analytics/events` endpoint
- API key authentication configured (`ANALYTICS_API_KEY` set in environment)
- Tenant header included: `X-Tenant: glowhairdressing`

✅ **Backend Proxy Configured:**
- Requests forwarded with `Authorization: Bearer <API_KEY>` header
- CSRF token requirement skipped for analytics endpoint
- All required headers included

## Request Format We're Sending

**Endpoint:** `POST /api/analytics/events`

**Headers:**
```
Content-Type: application/json
X-Tenant: glowhairdressing
Authorization: Bearer ek_live_...
```

**Request Body Format:**
```json
{
  "events": [
    {
      "type": "page_view_geo",
      "url": "https://glow-test.onrender.com/about",
      "consent": true,
      "country": "SE",
      "region": "Stockholm",
      "city": "Stockholm",
      "continent": "EU",
      "latitude": 59.3293,
      "longitude": 18.0686,
      "timezone": "Europe/Stockholm",
      "sessionId": "sess_abc123...",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "timestamp": 1705672800000,
      "referrer": "https://google.com",
      "title": "About Us - Glow Hairdressing"
    }
  ]
}
```

## Data Fields Being Sent

According to your verification document, all these fields should be supported:

1. **Event Type**: `page_view_geo` ✅
2. **Geographic Data**: 
   - `country` (e.g., "SE")
   - `region` (e.g., "Stockholm")
   - `city` (e.g., "Stockholm")
   - `continent` (e.g., "EU")
   - `latitude` (decimal)
   - `longitude` (decimal)
   - `timezone` (e.g., "Europe/Stockholm")

3. **Session Tracking**: 
   - `sessionId` (persistent across page views)

4. **User Context**: 
   - `userAgent` (full user agent string)
   - `timezone` (from event data)

5. **Page Context**: 
   - `url` (full page URL)
   - `title` (page title)
   - `referrer` (referring URL)

6. **Consent**: 
   - `consent: true` (only sent when user has granted consent)

7. **Timestamp**: 
   - Unix timestamp in milliseconds

## What We Need Verified

Please confirm the following:

1. ✅ **Events are being received successfully**
   - Are requests with valid API key being accepted?
   - Are events being processed without errors?

2. ✅ **Data is being stored correctly**
   - Are all geographic fields (`country`, `region`, `city`, `continent`, `latitude`, `longitude`, `timezone`) being stored?
   - Is the `sessionId` being tracked correctly for session grouping?
   - Are `url`, `title`, and `referrer` being stored in the correct fields?

3. ✅ **Geographic data is available in analytics**
   - Can you see geographic data in the analytics dashboard (`/geografisk-layout2`)?
   - Are country/region/city breakdowns working?

4. ✅ **Session tracking is working**
   - Are multiple events with the same `sessionId` being grouped correctly?
   - Is session persistence working across page views?

5. ✅ **API Key authentication is functioning**
   - Is the API key for tenant `glowhairdressing` active and validated?
   - Are usage statistics being updated correctly?

## Current Status from Our Side

**Working:**
- ✅ Frontend sends events with user consent
- ✅ Backend proxy forwards requests with API key authentication
- ✅ Events are sent on page navigation (after consent is granted)
- ✅ All required headers are included
- ✅ Request format matches your verification document

**From Render Logs:**
- API key is detected and included in Authorization header
- Tenant header is being sent correctly
- Requests are reaching the endpoint successfully

## Test Request Example

If you need to test manually, here's the exact format we're sending:

```bash
curl -X POST https://source-database.onrender.com/api/analytics/events \
  -H "Content-Type: application/json" \
  -H "X-Tenant: glowhairdressing" \
  -H "Authorization: Bearer ek_live_..." \
  -d '{
    "events": [{
      "type": "page_view_geo",
      "url": "https://glow-test.onrender.com/about",
      "consent": true,
      "country": "SE",
      "region": "Stockholm",
      "city": "Stockholm",
      "continent": "EU",
      "latitude": 59.3293,
      "longitude": 18.0686,
      "timezone": "Europe/Stockholm",
      "sessionId": "sess_abc123...",
      "userAgent": "Mozilla/5.0...",
      "timestamp": 1705672800000,
      "referrer": "https://google.com",
      "title": "About Us - Glow Hairdressing"
    }]
  }'
```

## ⚠️ Current Issue

We're experiencing a **403 Forbidden** error with the message "Ogiltig eller saknad CSRF-token" (Invalid or missing CSRF token) when sending requests to `/api/analytics/events`.

**What we're sending:**
- ✅ `Authorization: Bearer ek_live_...` (API key in header)
- ✅ `X-Tenant: glowhairdressing` (tenant header)
- ✅ `Content-Type: application/json`
- ❌ No CSRF token (intentionally, as per API key authentication)

**Backend response:**
- Status: `403 Forbidden`
- Message: `"Ogiltig eller saknad CSRF-token"`

**Expected behavior:**
According to your verification document, the `/api/analytics/events` endpoint should use API key authentication (`validateApiKey` middleware) and **skip CSRF validation** when a valid API key is present.

**Question:** 
Is the backend endpoint configured to skip CSRF validation when API key authentication is used? The endpoint might be checking CSRF tokens before validating the API key, which would cause this error.

## Questions

1. **🔴 URGENT**: Is the `/api/analytics/events` endpoint configured to skip CSRF validation when API key authentication is present?
2. Are events appearing in your analytics database for tenant `glowhairdressing`?
3. Can you see geographic data (country, region, city) in the analytics dashboard?
4. Are there any errors in your logs related to our requests?
5. Is the API key validation working correctly?
6. Are there any missing or incorrectly formatted fields we should adjust?

Please let us know:
- ✅ If data extraction is working correctly
- ⚠️ If there are any issues or missing data fields
- 📊 If you can see the data in your analytics dashboard
- 🔴 **If the CSRF validation needs to be disabled for API key authenticated requests**

Thank you for your support!

---

**Reference:** ANALYTICS_EVENTS_VERIFICATION.md

