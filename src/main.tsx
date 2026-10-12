import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App, MissingConfig } from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import { supabase } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabase ? (
      <AuthProvider client={supabase}>
        <App client={supabase} />
      </AuthProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
)
