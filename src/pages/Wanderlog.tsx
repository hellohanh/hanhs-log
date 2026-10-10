import { Route, Routes } from 'react-router-dom'
import TripList from './wander/TripList'
import TripPage from './wander/TripPage'
import JoinTrip from './wander/JoinTrip'

// Wanderlog inside Hanh's Log (milestone 3).
//   /wander               the trip list
//   /wander/trip/:id      a trip (map arrives in step 3)
//   /wander/join/:token   an invite link
export default function Wanderlog() {
  return (
    <Routes>
      <Route index element={<TripList />} />
      <Route path="trip/:tripId" element={<TripPage />} />
      <Route path="join/:token" element={<JoinTrip />} />
      <Route path="*" element={<TripList />} />
    </Routes>
  )
}
