import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import { RouterProvider } from 'react-router-dom'
import { router } from './router.jsx'
import { AuthContextProvider } from './context/AuthContext.jsx'

// 1. Find the empty <div id="root"> inside index.html and tell React to take control of it
createRoot(document.getElementById('root')).render(
  // 2. StrictMode runs the app twice in development to uncover hidden bugs
  <StrictMode>
    {/* 3. AuthContextProvider creates a global memory bubble holding the Supabase login status for the whole app */}
    <AuthContextProvider>
      {/* 4. RouterProvider intercepts the URL (like /dashboard) and loads the correct React Component file */}
      <RouterProvider router={router} />
    </AuthContextProvider>
  </StrictMode>
)
