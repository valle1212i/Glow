# Glow - Premium Hairdresser Website

A modern, responsive React website for Glow hairdresser, inspired by the design aesthetics of whoiselijah.com and joseeberbeauty.com.

## Features

- ✨ **Smooth Animations** - Powered by Framer Motion for fluid, professional animations
- 🎨 **Modern Design** - Clean, minimalist design with elegant typography
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices
- 🛒 **Shopping Cart** - Interactive cart with slide-out sidebar
- 🎯 **React Router** - Multi-page navigation
- 🎭 **Context API** - State management for cart functionality

## Design Analysis

Based on the analysis of both reference websites:

### Typography
- **Headings**: Playfair Display (elegant serif for titles)
- **Body**: Inter (modern, clean sans-serif)
- Clean, minimal typography with proper spacing

### Layout
- Fixed navigation bar with smooth scroll effects
- Full-screen hero section with overlay
- Grid-based product layouts
- Card-based design for products and experiences
- Multi-column footer

### Color Scheme
- Primary: Black (#000000) and White (#ffffff)
- Accents: Subtle grays for text hierarchy
- Clean, professional aesthetic

### Animations
- Smooth page transitions
- Hover effects on interactive elements
- Stagger animations for product grids
- Slide-in cart sidebar
- Scroll-triggered animations

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Project Structure

```
Glow/
├── src/
│   ├── components/
│   │   ├── Navigation.jsx
│   │   ├── Hero.jsx
│   │   ├── Products.jsx
│   │   ├── Experience.jsx
│   │   ├── Cart.jsx
│   │   └── Footer.jsx
│   ├── context/
│   │   └── CartContext.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
└── vite.config.js
```

## Technologies Used

- **React 18** - UI library
- **React Router** - Navigation
- **Framer Motion** - Animations
- **Vite** - Build tool
- **React Icons** - Icon library

## Customization

- Update product data in `src/components/Products.jsx`
- Modify colors in `src/index.css` (CSS variables)
- Adjust animations in component files
- Replace placeholder images with your own

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

