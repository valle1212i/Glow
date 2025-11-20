import { trackGeoEvent, getSessionId } from './api'

const CONSENT_STORAGE_KEY = 'analytics_consent'
const CONSENT_DISMISSED_KEY = 'analytics_consent_dismissed'
const GEO_CACHE_KEY = 'glow_geo_data'
const GEO_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export const hasAnalyticsConsent = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CONSENT_STORAGE_KEY) === 'granted'
}

export const setAnalyticsConsent = (granted) => {
  if (typeof window === 'undefined') return
  if (granted) {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    document.cookie = 'analytics_consent=true; max-age=31536000; path=/'
    localStorage.removeItem(CONSENT_DISMISSED_KEY)
  } else {
    localStorage.removeItem(CONSENT_STORAGE_KEY)
    document.cookie = 'analytics_consent=; Max-Age=0; path=/'
  }
}

export const markConsentDismissed = () => {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_DISMISSED_KEY, 'true')
}

export const hasDismissedConsent = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CONSENT_DISMISSED_KEY) === 'true'
}

const getContinentFromCountry = (countryCode) => {
  const continentMap = {
    SE: 'EU', NO: 'EU', DK: 'EU', FI: 'EU', DE: 'EU', FR: 'EU', ES: 'EU', IT: 'EU', GB: 'EU',
    US: 'NA', CA: 'NA', MX: 'NA',
    BR: 'SA', AR: 'SA', CL: 'SA',
    CN: 'AS', JP: 'AS', IN: 'AS', SG: 'AS',
    ZA: 'AF', NG: 'AF', EG: 'AF',
    AU: 'OC', NZ: 'OC'
  }
  return continentMap[countryCode] || null
}

const cacheGeoData = (data) => {
  if (typeof window === 'undefined') return
  const payload = {
    ...data,
    cachedAt: Date.now()
  }
  sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload))
}

const getCachedGeoData = () => {
  if (typeof window === 'undefined') return null
  const cached = sessionStorage.getItem(GEO_CACHE_KEY)
  if (!cached) return null
  try {
    const data = JSON.parse(cached)
    if (Date.now() - data.cachedAt < GEO_CACHE_TTL) {
      return data
    }
  } catch (error) {
    console.warn('Failed to parse cached geo data:', error)
  }
  return null
}

export const getGeoData = async () => {
  if (typeof window === 'undefined') return null

  const cached = getCachedGeoData()
  if (cached) {
    return cached
  }

  try {
    const response = await fetch('https://ipapi.co/json/')
    if (!response.ok) {
      throw new Error(`Geo lookup failed: ${response.status}`)
    }
    const data = await response.json()
    const geo = {
      country: data.country_code,
      region: data.region,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      continent: getContinentFromCountry(data.country_code)
    }
    if (geo.country) {
      cacheGeoData(geo)
    }
    return geo
  } catch (error) {
    console.warn('Failed to fetch geo data:', error)
    return null
  }
}

export const trackGeoPageView = async () => {
  if (!hasAnalyticsConsent()) {
    console.log('Consent not granted, skipping geo tracking')
    return { success: false, consent: false }
  }

  const geoData = await getGeoData()
  if (!geoData || !geoData.country) {
    console.warn('Geo data unavailable, skipping geo tracking')
    return { success: false, reason: 'geo_unavailable' }
  }

  const event = {
    type: 'page_view_geo',
    url: typeof window !== 'undefined' ? window.location.href : '',
    consent: true,
    country: geoData.country,
    region: geoData.region,
    city: geoData.city,
    continent: geoData.continent,
    latitude: geoData.latitude,
    longitude: geoData.longitude,
    timezone: geoData.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null),
    sessionId: typeof window !== 'undefined' ? getSessionId() : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: Date.now(),
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    title: typeof document !== 'undefined' ? document.title : ''
  }

  return trackGeoEvent(event)
}
