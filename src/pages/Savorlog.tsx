import { Route, Routes } from 'react-router-dom'
import SavorPage from './savor/SavorPage'
import JoinSavor from './savor/JoinSavor'

// Savorlog inside Hanh's Log (milestone 4): the shared eatery catalogue.
//   /savor              the catalogue by country → dish, on a map (4c/4d)
//   /savor/join/:token  the family invite link (4e)
export default function Savorlog() {
  return (
    <Routes>
      <Route index element={<SavorPage />} />
      <Route path="join/:token" element={<JoinSavor />} />
      <Route path="*" element={<SavorPage />} />
    </Routes>
  )
}
