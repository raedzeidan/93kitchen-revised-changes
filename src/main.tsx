import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// The published Figma host only serves static files. Keep account and checkout
// cookies first-party by opening the same route on the full-stack storefront.
if (location.hostname === '93kitchenn1.figma.site') {
  location.replace('https://br-flat-band-bakog1t3-kitchen.compute.c-8.eu-central-1.aws.neon.tech/' + location.hash)
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><App /></React.StrictMode>,
  )
}
