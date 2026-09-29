import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// 🔥 TAMBAHAN
import { MapProvider } from "./context/MapContext";
import { AuthProvider } from "./context/AuthContext"; // ✅ TAMBAHAN BARU

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>

      {/* 🔥 WRAP SEMUA PROVIDER (TIDAK MERUSAK YANG LAMA) */}
      <AuthProvider> {/* ✅ TAMBAHAN */}
        <MapProvider>
          <App />
        </MapProvider>
      </AuthProvider>

    </BrowserRouter>
  </React.StrictMode>,
)