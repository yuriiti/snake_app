import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegram } from './telegram'

// Initialize Telegram Mini App context if available
initTelegram()

const el = document.getElementById('root')!
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
