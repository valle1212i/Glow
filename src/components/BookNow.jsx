import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { bookAppointment } from '../services/api'
import './BookNow.css'

const BookNow = () => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [submitted, setSubmitted] = useState(false)

  // Generate available time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ]

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
    }
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
    if (selectedDate && selectedTime && formData.name && formData.email && formData.phone) {
      try {
        const result = await bookAppointment({
          date: selectedDate,
          time: selectedTime,
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        })
        
        if (result.success) {
          setSubmitted(true)
          // Reset form after 3 seconds
          setTimeout(() => {
            setSubmitted(false)
            setSelectedDate(null)
            setSelectedTime('')
            setFormData({ name: '', email: '', phone: '' })
          }, 3000)
        } else {
          alert(result.error || 'Failed to book appointment. Please try again.')
        }
      } catch (error) {
        console.error('Booking error:', error)
        alert('An error occurred. Please try again.')
      }
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
            {selectedDate && (
              <div className="time-selection">
                <h3>Select Time</h3>
                <div className="time-slots-grid">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="booking-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                  required
                />
              </div>

              <motion.button
                type="submit"
                className="submit-booking-btn"
                disabled={!selectedDate || !selectedTime || !formData.name || !formData.email || !formData.phone}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {submitted ? 'Booking Confirmed!' : 'Confirm Booking'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default BookNow

