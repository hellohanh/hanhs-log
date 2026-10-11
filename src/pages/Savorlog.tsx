import { Route, Routes } from 'react-router-dom'
import SavorPage from './savor/SavorPage'

// Savorlog inside Hanh's Log (milestone 4): the shared eatery catalogue.
//   /savor   the catalogue by country → dish, on a map (step 4c)
export default function Savorlog() {
  return (
    <Routes>
      <Route index element={<SavorPage />} />
      <Route path="*" element={<SavorPage />} />
    </Routes>
  )
}
