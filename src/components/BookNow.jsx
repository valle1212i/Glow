import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { getBookingServices, getBookingProviders, createBooking, getBookings, getBookingSettings, getProviderAvailability } from '../services/api'
import './BookNow.css'

const BookNow = () => {
  const [services, setServices] = useState([])
  const [providers, setProviders] = useState([])
  const [selectedService, setSelectedService] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    partySize: 1,
    notes: '',
    specialRequests: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [bookingSettings, setBookingSettings] = useState(null)
  const [availableTimeSlots, setAvailableTimeSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [usingGeneralHours, setUsingGeneralHours] = useState(false)
  
  // Use refs to store current values for comparison without causing re-renders
  const servicesRef = useRef([])
  const providersRef = useRef([])

  // Load services and providers on mount and set up auto-refresh
  useEffect(() => {
    // Check if data has changed
    const hasDataChanged = (oldServices, oldProviders, newServices, newProviders) => {
      // Compare counts
      if (oldServices.length !== newServices.length || oldProviders.length !== newProviders.length) {
        return true
      }
      
      // Compare service IDs
      const oldServiceIds = new Set(oldServices.map(s => s._id))
      const newServiceIds = new Set(newServices.map(s => s._id))
      if (oldServiceIds.size !== newServiceIds.size) {
        return true
      }
      for (const id of newServiceIds) {
        if (!oldServiceIds.has(id)) return true
      }
      for (const id of oldServiceIds) {
        if (!newServiceIds.has(id)) return true
      }
      
      // Compare provider IDs
      const oldProviderIds = new Set(oldProviders.map(p => p._id))
      const newProviderIds = new Set(newProviders.map(p => p._id))
      if (oldProviderIds.size !== newProviderIds.size) {
        return true
      }
      for (const id of newProviderIds) {
        if (!oldProviderIds.has(id)) return true
      }
      for (const id of oldProviderIds) {
        if (!newProviderIds.has(id)) return true
      }
      
      return false
    }

    // Load and refresh services, providers, and settings
    const refreshServicesAndProviders = async (isInitialLoad = false) => {
      try {
        const [servicesResult, providersResult, settingsResult] = await Promise.all([
          getBookingServices(),
          getBookingProviders(),
          getBookingSettings()
        ])
        
        // Note: Public endpoints no longer require authentication
        // If we get empty results, it's because there are no services/providers configured
        
        const newServices = servicesResult.success ? servicesResult.services : []
        const newProviders = providersResult.success ? providersResult.providers : []
        
        // Get current values from refs
        const currentServices = servicesRef.current
        const currentProviders = providersRef.current
        
        // Only update if data has changed (or if it's initial load)
        if (isInitialLoad || hasDataChanged(currentServices, currentProviders, newServices, newProviders)) {
          if (isInitialLoad) {
            setIsLoading(true)
          }
          
          // Check if services changed
          const servicesChanged = JSON.stringify(currentServices.map(s => s._id)) !== JSON.stringify(newServices.map(s => s._id))
          const providersChanged = JSON.stringify(currentProviders.map(p => p._id)) !== JSON.stringify(newProviders.map(p => p._id))
          
          if (servicesResult.success) {
            setServices(newServices)
            servicesRef.current = newServices
            if (servicesChanged && !isInitialLoad) {
              console.log(`✅ Services updated (${newServices.length} services)`)
            }
          }
          
          if (providersResult.success) {
            setProviders(newProviders)
            providersRef.current = newProviders
            if (providersChanged && !isInitialLoad) {
              console.log(`✅ Providers updated (${newProviders.length} providers)`)
            }
          }
          
          // ✅ CRITICAL: Store settings for opening hours
          // Always set settings (either from API or defaults)
          if (settingsResult.success && settingsResult.settings) {
            setBookingSettings(settingsResult.settings)
            if (isInitialLoad && !settingsResult.usingDefaults) {
              console.log('✅ Booking settings loaded (opening hours configured)')
            } else if (isInitialLoad && settingsResult.usingDefaults) {
              // Silently using defaults - this is expected for public forms
            }
          } else {
            // Fallback to defaults if settings fetch completely fails
            setBookingSettings({
              calendarBehavior: {
                startTime: '09:00',
                endTime: '17:00',
                timeSlotInterval: 30
              }
            })
          }
          
          if (isInitialLoad) {
            if (newServices.length === 0 && newProviders.length === 0) {
              console.warn('⚠️ No services or providers found. Please configure them in the customer portal.')
            } else {
              console.log(`✅ Booking system initialized: ${newServices.length} services, ${newProviders.length} providers`)
            }
          }
          
          // If date is already selected, refresh available time slots with new settings
          if (selectedDate && selectedService && selectedProvider) {
            checkAvailability()
          }
        }
      } catch (error) {
        console.error('Error refreshing booking data:', error)
        if (isInitialLoad) {
          setError('Failed to load booking options. Please refresh the page.')
        }
      } finally {
        if (isInitialLoad) {
          setIsLoading(false)
        }
      }
    }
    
    // Initial load
    refreshServicesAndProviders(true)
    
    // Set up auto-refresh every 5 minutes (same as documentation recommendation)
    const refreshInterval = setInterval(() => {
      refreshServicesAndProviders(false)
    }, 5 * 60 * 1000) // 5 minutes
    
    // Refresh when user returns to the page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshServicesAndProviders(false)
      }
    }
    
    // Refresh when window gets focus
    const handleFocus = () => {
      refreshServicesAndProviders(false)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    // Cleanup
    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Generate time slots based on opening hours and existing bookings
  const generateTimeSlots = (date, durationMin, existingBookings, settings = null) => {
    const slots = []
    
    // ✅ CRITICAL: Get day of week for day-specific opening hours
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
    const dayOpeningHours = settings?.openingHours?.[dayOfWeek]
    
    // 🔍 DEBUG: Log opening hours being used
    console.log('🕐 [TIME SLOTS] Generating slots for:', {
      date: date.toLocaleDateString('sv-SE'),
      dayOfWeek: dayOfWeek,
      dayOpeningHours: dayOpeningHours,
      calendarBehavior: settings?.calendarBehavior,
      durationMin: durationMin
    })
    
    // ✅ CRITICAL: Use day-specific opening hours first, then fallback to calendarBehavior
    let startHour = null
    let endHour = null
    
    if (dayOpeningHours && dayOpeningHours.isOpen !== false && dayOpeningHours.start && dayOpeningHours.end) {
      // ✅ PRIORITY 1: Use day-specific opening hours (e.g., Friday 14:00-15:00)
      const [startHours, startMinutes] = dayOpeningHours.start.split(':').map(Number)
      const [endHours, endMinutes] = dayOpeningHours.end.split(':').map(Number)
      
      startHour = startHours
      endHour = endMinutes > 0 ? endHours + 1 : endHours + 1
      
      console.log('🕐 [TIME SLOTS] Using day-specific hours:', {
        start: dayOpeningHours.start,
        end: dayOpeningHours.end,
        startHour: startHour,
        endHour: endHour
      })
    } else if (dayOpeningHours?.isOpen === false) {
      // Business is closed on this day
      console.log('🕐 [TIME SLOTS] Business is closed on', dayOfWeek)
      return []
    } else if (settings?.calendarBehavior?.startTime && settings?.calendarBehavior?.endTime) {
      // ✅ PRIORITY 2: Fallback to general calendarBehavior times
      const [startHours] = settings.calendarBehavior.startTime.split(':').map(Number)
      const [endHours, endMinutes] = settings.calendarBehavior.endTime.split(':').map(Number)
      
      startHour = startHours
      endHour = endMinutes > 0 ? endHours + 1 : endHours + 1
      
      console.log('🕐 [TIME SLOTS] Using calendarBehavior hours:', {
        startTime: settings.calendarBehavior.startTime,
        endTime: settings.calendarBehavior.endTime,
        startHour: startHour,
        endHour: endHour
      })
    }
    
    // ✅ CRITICAL: If no settings, return empty (don't show any slots)
    if (startHour === null || endHour === null) {
      console.warn('⚠️ [TIME SLOTS] No opening hours configured - cannot generate time slots')
      return []
    }
    
    const slotInterval = settings?.calendarBehavior?.timeSlotInterval || 30
    
    // ✅ CRITICAL: Get actual closing time to filter slots that start at or after closing
    let actualEndHour = null
    let actualEndMinutes = null
    if (dayOpeningHours && dayOpeningHours.isOpen !== false && dayOpeningHours.end) {
      const [endH, endM] = dayOpeningHours.end.split(':').map(Number)
      actualEndHour = endH
      actualEndMinutes = endM
    } else if (settings?.calendarBehavior?.endTime) {
      const [endH, endM] = settings.calendarBehavior.endTime.split(':').map(Number)
      actualEndHour = endH
      actualEndMinutes = endM
    }
    
    console.log('🕐 [TIME SLOTS] Slot generation parameters:', {
      slotInterval: slotInterval,
      actualEndHour: actualEndHour,
      actualEndMinutes: actualEndMinutes,
      closingTime: actualEndHour !== null ? `${actualEndHour}:${actualEndMinutes.toString().padStart(2, '0')}` : 'not set',
      hourRange: `${startHour}-${endHour}`
    })
    
    let slotsGenerated = 0
    let slotsFilteredByClosing = 0
    let slotsFilteredByConflict = 0
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        
        // ✅ CRITICAL: Skip slots that start at or after the closing time
        if (actualEndHour !== null && actualEndMinutes !== null) {
          const slotStartMinutes = hour * 60 + minute
          const closingMinutes = actualEndHour * 60 + actualEndMinutes
          
          if (slotStartMinutes >= closingMinutes) {
            slotsFilteredByClosing++
            continue
          }
        }
        
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMin)
        
        // ✅ CRITICAL: Also check that the slot doesn't extend beyond closing time
        // Backend requires slots to END BEFORE closing time (not at or after closing time)
        if (actualEndHour !== null && actualEndMinutes !== null) {
          const slotEndMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes()
          const closingMinutes = actualEndHour * 60 + actualEndMinutes
          
          // Slot must end BEFORE closing time (not at or after)
          // Changed from > to >= to filter out slots that end exactly at closing time
          if (slotEndMinutes >= closingMinutes) {
            slotsFilteredByClosing++
            if (slotsFilteredByClosing <= 3) {
              console.log(`  ⏰ [TIME SLOTS] Filtered slot ${slotStart.toTimeString().slice(0, 5)}-${slotEnd.toTimeString().slice(0, 5)}: ends at/after closing ${actualEndHour}:${actualEndMinutes.toString().padStart(2, '0')}`)
            }
            continue
          }
        }
        
        // Check for conflicts with existing bookings
        const hasConflict = existingBookings.some(booking => {
          const bookingStart = new Date(booking.start)
          const bookingEnd = new Date(booking.end)
          return (slotStart < bookingEnd && slotEnd > bookingStart)
        })
        
        if (!hasConflict) {
          slots.push({
            start: slotStart,
            end: slotEnd,
            display: slotStart.toLocaleTimeString('sv-SE', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            value: slotStart.toTimeString().slice(0, 5) // HH:mm format
          })
          slotsGenerated++
        } else {
          slotsFilteredByConflict++
        }
      }
    }
    
    console.log('🕐 [TIME SLOTS] Generation complete:', {
      totalSlotsGenerated: slotsGenerated,
      slotsFilteredByClosing: slotsFilteredByClosing,
      slotsFilteredByConflict: slotsFilteredByConflict,
      availableSlots: slots.length,
      slotTimes: slots.map(s => s.display).slice(0, 10) // Show first 10 slots
    })
    
    return slots
  }
  
  // Check availability when service, provider, or date changes
  const checkAvailability = useCallback(async () => {
    if (!selectedDate || !selectedService || !selectedProvider) {
      setAvailableTimeSlots([])
      setUsingGeneralHours(false)
      return
    }
    
    setLoadingSlots(true)
    setUsingGeneralHours(false) // Reset until we know
    
    try {
      const service = services.find(s => s._id === selectedService)
      if (!service) {
        setAvailableTimeSlots([])
        setUsingGeneralHours(false)
        setLoadingSlots(false)
        return
      }
      
      const durationMin = service.durationMin || 60
      const date = new Date(selectedDate)
      
      console.log('📋 [AVAILABILITY] Checking availability:', {
        date: date.toLocaleDateString('sv-SE'),
        serviceId: selectedService,
        providerId: selectedProvider,
        durationMin: durationMin
      })
      
      // ✅ NEW: Use provider-specific availability endpoint
      const availabilityResult = await getProviderAvailability(selectedProvider, date, durationMin)
      
      if (availabilityResult.success && availabilityResult.availability) {
        const availability = availabilityResult.availability
        
        console.log('✅ [AVAILABILITY] Provider-specific availability:', {
          providerName: availability.providerName,
          openingHours: availability.openingHours,
          availableSlotsCount: availability.availableSlots?.length || 0,
          breaks: availability.breaks?.length || 0,
          hasSpecificHours: availability.hasSpecificHours,
          usingGeneralHours: availability.usingGeneralHours
        })
        
        // ✅ NEW: Use hasSpecificHours and usingGeneralHours flags from backend
        const hasSpecificHours = availability.hasSpecificHours === true
        const usingGeneralHours = availability.usingGeneralHours === true
        
        // Check if provider is available
        if (availability.openingHours?.isOpen === false) {
          // Provider is explicitly marked as not available
          console.warn('⚠️ [AVAILABILITY] Provider is not available on this day (explicitly closed)')
          setAvailableTimeSlots([])
          setUsingGeneralHours(false)
          setLoadingSlots(false)
          return
        }
        
        // If provider has available slots, use them (regardless of whether they're from specific or general hours)
        if (availability.openingHours?.isOpen === true && availability.availableSlots?.length > 0) {
          // Provider has specific hours and available slots - use them
          const slots = (availability.availableSlots || []).map(slotTime => {
            const [hours, minutes] = slotTime.split(':').map(Number)
            const slotStart = new Date(date)
            slotStart.setHours(hours, minutes, 0, 0)
            
            const slotEnd = new Date(slotStart)
            slotEnd.setMinutes(slotEnd.getMinutes() + durationMin)
            
            return {
              start: slotStart,
              end: slotEnd,
              display: slotTime,
              value: slotTime // HH:mm format
            }
          })
          
          console.log('✅ [AVAILABILITY] Available slots from provider API:', {
            count: slots.length,
            slots: slots.map(s => ({ display: s.display, value: s.value })),
            hasSpecificHours: hasSpecificHours,
            usingGeneralHours: usingGeneralHours
          })
          
          // Store whether we're using general hours for UI display
          setUsingGeneralHours(usingGeneralHours)
          
          if (usingGeneralHours) {
            console.log('ℹ️ [AVAILABILITY] Using general opening hours (provider has no specific hours configured)')
          }
          
          setAvailableTimeSlots(slots)
          setLoadingSlots(false)
          return
        } else if (availability.openingHours?.isOpen === true && (!availability.availableSlots || availability.availableSlots.length === 0)) {
          // Provider is open but no slots available (fully booked or other reason)
          console.warn('⚠️ [AVAILABILITY] Provider is open but no slots available')
          setAvailableTimeSlots([])
          setLoadingSlots(false)
          return
        }
        // If we get here, provider has no specific hours - fall through to general opening hours
      }
      
      // Fallback to general opening hours if:
      // 1. Provider availability endpoint is not available
      // 2. Provider has no specific hours configured (isOpen: false, no start/end)
      console.log('ℹ️ [AVAILABILITY] Using general opening hours (provider has no specific hours configured)')
      
      if (!bookingSettings) {
        setAvailableTimeSlots([])
        setLoadingSlots(false)
        return
      }
      
      // Get bookings for the selected day
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)
      
      const bookingsResult = await getBookings(dayStart, dayEnd, selectedProvider)
      const existingBookings = bookingsResult.success ? (bookingsResult.bookings || []) : []
      
      // Generate available slots using settings (fallback)
      const slots = generateTimeSlots(date, durationMin, existingBookings, bookingSettings)
      setUsingGeneralHours(true) // We're using general hours as fallback
      setAvailableTimeSlots(slots)
      
      // Get actual closing time for validation warning
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
      const dayOpeningHours = bookingSettings?.openingHours?.[dayOfWeek]
      let actualEndHour = null
      let actualEndMinutes = null
      if (dayOpeningHours && dayOpeningHours.isOpen !== false && dayOpeningHours.end) {
        const [endH, endM] = dayOpeningHours.end.split(':').map(Number)
        actualEndHour = endH
        actualEndMinutes = endM
      } else if (bookingSettings?.calendarBehavior?.endTime) {
        const [endH, endM] = bookingSettings.calendarBehavior.endTime.split(':').map(Number)
        actualEndHour = endH
        actualEndMinutes = endM
      }
      
      console.log('✅ [AVAILABILITY] Available slots:', {
        count: slots.length,
        slots: slots.map(s => ({ 
          display: s.display, 
          value: s.value, 
          start: s.start.toISOString(), 
          end: s.end.toISOString(),
          startLocal: s.start.toLocaleString('sv-SE'),
          endLocal: s.end.toLocaleString('sv-SE')
        })),
        closingTime: actualEndHour !== null ? `${actualEndHour}:${actualEndMinutes.toString().padStart(2, '0')}` : 'not set',
        warning: '⚠️ Backend may check provider-specific availability - slots might still be rejected'
      })
      
      // Warn about potential backend rejection
      if (slots.length > 0) {
        console.warn('⚠️ [AVAILABILITY] Note: Backend validates against provider-specific availability. These slots might be rejected if provider has different hours.')
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      setAvailableTimeSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedDate, selectedService, selectedProvider, bookingSettings, services])
  
  // Check availability when service, provider, or date changes
  // Note: No longer requires bookingSettings since we use provider-specific availability
  useEffect(() => {
    if (selectedDate && selectedService && selectedProvider && services.length > 0) {
      checkAvailability()
    } else {
      setAvailableTimeSlots([])
    }
  }, [selectedDate, selectedService, selectedProvider, services, checkAvailability])

  // Get duration from selected service
  const getSelectedServiceDuration = () => {
    const service = services.find(s => s._id === selectedService)
    return service?.durationMin || 60
  }

  // Get current date and generate calendar days
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay()
  }

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear)
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
    const days = []
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day)
      // Only show future dates and today
      if (date >= todayDate) {
        days.push(day)
      } else {
        days.push(null)
      }
    }

    return days
  }

  const calendarDays = generateCalendarDays()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handleDateSelect = (day) => {
    if (day !== null) {
      const date = new Date(currentYear, currentMonth, day)
      setSelectedDate(date)
      setSelectedTime('') // Reset time when date changes
      // Availability will be checked automatically via useEffect
    }
  }

  const handleServiceChange = (e) => {
    setSelectedService(e.target.value)
  }

  const handleProviderChange = (e) => {
    setSelectedProvider(e.target.value)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validate required fields
    if (!selectedService || !selectedProvider || !selectedDate || !selectedTime || !formData.name) {
      setError('Please fill in all required fields.')
      return
    }
    
    setIsProcessing(true)
    
    try {
      // Format date as YYYY-MM-DD in local time to avoid off-by-one issues
      const dateStr = [
        selectedDate.getFullYear(),
        String(selectedDate.getMonth() + 1).padStart(2, '0'),
        String(selectedDate.getDate()).padStart(2, '0')
      ].join('-')
      const duration = getSelectedServiceDuration()
      
      const result = await createBooking({
        serviceId: selectedService,
        providerId: selectedProvider,
        date: dateStr,
        startTime: selectedTime,
        duration: duration,
        customerName: formData.name,
        email: formData.email || '',
        phone: formData.phone || ''
        })
        
        if (result.success) {
          setSubmitted(true)
          // Reset form after 3 seconds
          setTimeout(() => {
            setSubmitted(false)
          setSelectedService('')
          setSelectedProvider('')
            setSelectedDate(null)
            setSelectedTime('')
            setFormData({ name: '', email: '', phone: '', partySize: 1, notes: '', specialRequests: '' })
          }, 3000)
        } else {
        if (result.conflict) {
          // Show backend's specific error message
          let errorMessage = result.error || 'This time slot is already booked. Please choose another time.'
          
          // Check if it's an "outside working hours" error - might be provider-specific availability
          if (result.error && result.error.includes('utanför arbetstider')) {
            errorMessage = 'Denna tid är inte tillgänglig för den valda personalen. Vänligen välj en annan tid eller personal.'
            
            // Log detailed conflict info
            if (result.conflicts && result.conflicts.length > 0) {
              const conflict = result.conflicts[0]
              if (conflict.reason === 'OUTSIDE_WORKING_HOURS') {
                console.error('❌ [BOOKING] Provider-specific availability issue:', {
                  providerId: selectedProvider,
                  date: selectedDate?.toLocaleDateString('sv-SE'),
                  time: selectedTime,
                  conflict: conflict
                })
              }
            }
          }
          
          setError(errorMessage)
          
          // Log conflict details for debugging
          if (result.conflicts && result.conflicts.length > 0) {
            console.error('❌ [BOOKING] Conflict details:', result.conflicts)
          }
          
          // Refresh availability in case the slot was just taken
          await checkAvailability()
        } else {
          setError(result.error || 'Failed to book appointment. Please try again.')
        }
      }
    } catch (error) {
      console.error('Booking error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="book-now-page">
      <div className="container">
        <motion.div
          className="book-now-header"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="page-title">Book Now</h1>
          <p className="page-subtitle">Select a date and time for your appointment</p>
        </motion.div>

        <div className="booking-container">
          {/* Calendar Section */}
          <motion.div
            className="calendar-section"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="calendar-header">
              <h2>{monthNames[currentMonth]} {currentYear}</h2>
            </div>
            <div className="calendar-grid">
              {dayNames.map(day => (
                <div key={day} className="calendar-day-name">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => (
                <button
                  key={index}
                  className={`calendar-day ${day === null ? 'disabled' : ''} ${
                    selectedDate && day === selectedDate.getDate() ? 'selected' : ''
                  }`}
                  onClick={() => handleDateSelect(day)}
                  disabled={day === null}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDate && (
              <div className="selected-date-display">
                Selected: {formatDate(selectedDate)}
              </div>
            )}
          </motion.div>

          {/* Time Selection and Form Section */}
          <motion.div
            className="booking-form-section"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {isLoading ? (
              <div className="loading-message">Loading booking options...</div>
            ) : (
              <>
                {services.length === 0 && providers.length === 0 && (
                  <div className="error-message" style={{ marginBottom: '20px' }}>
                    <strong>⚠️ No booking options available</strong>
                    <p style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                      Services and staff members are not currently configured. Please contact us directly to make a booking.
                    </p>
                  </div>
                )}
                <form className="booking-form" onSubmit={handleSubmit}>
                  {services.length > 0 ? (
                    <div className="form-group">
                      <label htmlFor="service">Service *</label>
                      <select
                        id="service-select"
                        name="service"
                        value={selectedService}
                        onChange={handleServiceChange}
                        required
                      >
                        <option value="">Select a service...</option>
                        {services.map(service => (
                          <option key={service._id} value={service._id}>
                            {service.name} ({service.durationMin} min)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label htmlFor="service">Service *</label>
                      <input
                        type="text"
                        id="service"
                        name="service"
                        placeholder="Enter service name"
                        required
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      />
                      <small style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                        Service selection unavailable. Please contact us directly.
                      </small>
                    </div>
                  )}

                  {providers.length > 0 ? (
                    <div className="form-group">
                      <label htmlFor="provider">Staff Member *</label>
                      <select
                        id="provider-select"
                        name="provider"
                        value={selectedProvider}
                        onChange={handleProviderChange}
                        required
                      >
                        <option value="">Select a staff member...</option>
                        {providers.map(provider => (
                          <option key={provider._id} value={provider._id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label htmlFor="provider">Staff Member *</label>
                      <input
                        type="text"
                        id="provider"
                        name="provider"
                        placeholder="Enter staff member name"
                        required
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      />
                      <small style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                        Staff selection unavailable. Please contact us directly.
                      </small>
                    </div>
                  )}

            {selectedDate && (
              <div className="time-selection">
                <h3>Select Time</h3>
                {loadingSlots ? (
                  <div className="loading-message">Loading available times...</div>
                ) : availableTimeSlots.length === 0 ? (
                  <div className="fully-booked-message">
                    <strong>⚠️ Denna dag är fullbokad</strong>
                    <p>Välj ett annat datum för att fortsätta med din bokning.</p>
                  </div>
                ) : (
                  <>
                <div className="time-slots-grid">
                      {availableTimeSlots.map((slot, index) => (
                    <button
                          key={index}
                            type="button"
                          className={`time-slot ${selectedTime === slot.value ? 'selected' : ''}`}
                          onClick={() => setSelectedTime(slot.value)}
                    >
                          {slot.display}
                    </button>
                  ))}
                </div>
                    {usingGeneralHours && availableTimeSlots.length > 0 && (
                      <div className="availability-note" style={{ marginTop: '15px', padding: '10px', background: '#e7f3ff', borderRadius: '5px', fontSize: '0.85rem', color: '#0066cc' }}>
                        <strong>ℹ️ Info:</strong> Tillgänglighet baseras på allmänna öppettider. Den valda personalen har inga specifika arbetstider konfigurerade.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

              {/* Name - always required */}
              <div className="form-group">
                <label htmlFor="name">Namn *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ditt fullständiga namn"
                  required
                />
              </div>

              {/* ✅ Email - show only if requireEmail is enabled */}
              {bookingSettings?.formFields?.requireEmail && (
              <div className="form-group">
                  <label htmlFor="email">
                    E-post {bookingSettings.formFields.requireEmail ? '*' : ''}
                  </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                    placeholder="din.email@example.com"
                    required={bookingSettings.formFields.requireEmail}
                />
              </div>
              )}

              {/* ✅ Phone - show only if requirePhone is enabled */}
              {bookingSettings?.formFields?.requirePhone && (
              <div className="form-group">
                  <label htmlFor="phone">
                    Telefon {bookingSettings.formFields.requirePhone ? '*' : ''}
                  </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                      placeholder="+46 123 456 789"
                    required={bookingSettings.formFields.requirePhone}
                  />
                </div>
              )}

              {/* ✅ Party Size - show only if requirePartySize is enabled */}
              {bookingSettings?.formFields?.requirePartySize && (
                <div className="form-group">
                  <label htmlFor="partySize">
                    Gruppstorlek {bookingSettings.formFields.requirePartySize ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    id="partySize"
                    name="partySize"
                    min="1"
                    value={formData.partySize || 1}
                    onChange={(e) => handleInputChange({ target: { name: 'partySize', value: parseInt(e.target.value) || 1 } })}
                    required={bookingSettings.formFields.requirePartySize}
                  />
                </div>
              )}

              {/* ✅ Notes - show only if requireNotes is enabled */}
              {bookingSettings?.formFields?.requireNotes && (
                <div className="form-group">
                  <label htmlFor="notes">
                    Anteckningar {bookingSettings.formFields.requireNotes ? '*' : ''}
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    required={bookingSettings.formFields.requireNotes}
                    rows="3"
                    placeholder="Lägg till anteckningar om din bokning..."
                  />
                </div>
              )}

              {/* ✅ Special Requests - show only if allowSpecialRequests is enabled (optional) */}
              {bookingSettings?.formFields?.allowSpecialRequests && (
                <div className="form-group">
                  <label htmlFor="specialRequests">Särskilda önskemål</label>
                  <textarea
                    id="specialRequests"
                    name="specialRequests"
                    value={formData.specialRequests || ''}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Har du några särskilda önskemål?"
                />
              </div>
              )}

                  {error && (
                    <div className="error-message">{error}</div>
                  )}

                  {/* Disable submit button if day is fully booked */}
                  {selectedDate && availableTimeSlots.length === 0 && !loadingSlots && (
                    <div className="fully-booked-message" style={{ marginTop: '10px' }}>
                      <strong>⚠️ Denna dag är fullbokad</strong>
                      <p>Välj ett annat datum för att fortsätta med din bokning.</p>
                    </div>
                  )}

                  {(services.length === 0 || providers.length === 0) ? (
                    <div style={{ padding: '20px', background: 'var(--bg-light)', borderRadius: '5px', textAlign: 'center' }}>
                      <p style={{ marginBottom: '15px', color: 'var(--text-gray)' }}>
                        To make a booking, please contact us directly:
                      </p>
                      <p style={{ fontSize: '1.1rem', fontWeight: 400 }}>
                        <strong>Email:</strong> info@glowhairdresser.com<br />
                        <strong>Phone:</strong> +1 (234) 567-8900
                      </p>
                    </div>
                  ) : (
              <motion.button
                type="submit"
                className="submit-booking-btn"
                      disabled={!selectedService || !selectedProvider || !selectedDate || !selectedTime || !formData.name || isProcessing || availableTimeSlots.length === 0}
                      whileHover={{ scale: isProcessing || availableTimeSlots.length === 0 ? 1 : 1.02 }}
                      whileTap={{ scale: isProcessing || availableTimeSlots.length === 0 ? 1 : 0.98 }}
              >
                      {isProcessing ? 'Processing...' : submitted ? 'Booking Confirmed!' : 'Confirm Booking'}
              </motion.button>
                  )}
            </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default BookNow

