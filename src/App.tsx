import { Route, Routes } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Home from './pages/Home'
import Wanderlog from './pages/Wanderlog'
import Savorlog from './pages/Savorlog'
import SignIn from './pages/SignIn'
import Search from './pages/Search'
import NotFound from './pages/NotFound'
import MapStyles from './pages/MapStyles'

export default function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wander/*" element={<Wanderlog />} />
        <Route path="/savor/*" element={<Savorlog />} />
        <Route path="/search" element={<Search />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/map-styles" element={<MapStyles />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
