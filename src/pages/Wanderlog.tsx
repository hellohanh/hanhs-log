import { Link, Route, Routes, useParams } from 'react-router-dom'
import TripList from './wander/TripList'

// Wanderlog inside Hanh's Log (milestone 3). /wander is the trip list;
// /wander/trip/:id is the trip page (map), built in the next step.
export default function Wanderlog() {
  return (
    <Routes>
      <Route index element={<TripList />} />
      <Route path="trip/:tripId" element={<TripComingNext />} />
      <Route path="*" element={<TripList />} />
    </Routes>
  )
}

function TripComingNext() {
  const { tripId } = useParams()
  return (
    <main className="page segoe" data-trip-id={tripId}>
      <p className="eyebrow">Wanderlog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>Trip page</h1>
      <p className="lede">
        The trip page and map arrive in the next step of milestone 3. <Link to="/wander">Back to your trips</Link>.
      </p>
    </main>
  )
}
