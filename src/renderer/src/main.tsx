import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')

if (!window.localops) {
  if (rootEl) {
    rootEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a4abb7;font-family:Segoe UI,sans-serif">LocalOps yalnızca Electron uygulaması içinde çalıştırılabilir.</div>'
  }
} else if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
