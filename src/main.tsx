import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import './styles/tokens.css'
import './styles/base.css'

// basename = the site's sub-path (/hanhs-log/ live, /hanhs-log/pr-preview/pr-N/
// on previews). Without it GitHub Pages renders a silent blank page (L2).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
