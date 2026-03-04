import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

console.log("React entry point: main.jsx initializing...");
console.log("Root element found:", !!document.getElementById('root'));

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
)
