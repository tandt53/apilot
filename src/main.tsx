import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import {db} from './lib/db'

// Expose db to window for debugging
if (typeof window !== 'undefined') {
  (window as any).db = db
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
