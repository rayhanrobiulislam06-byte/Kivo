import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
