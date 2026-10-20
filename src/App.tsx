import { Route, Routes } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Home from './pages/Home'
import Wanderlog from './pages/Wanderlog'
import Savorlog from './pages/Savorlog'
import RoamPage from './pages/roam/RoamPage'
import SignIn from './pages/SignIn'
import Search from './pages/Search'
import NotFound from './pages/NotFound'
import UpdateNotice from './components/UpdateNotice'
import OfflineBanner from './components/OfflineBanner'

export default function App() {
  return (
    <>
      <OfflineBanner />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wander/*" element={<Wanderlog />} />
        <Route path="/savor/*" element={<Savorlog />} />
        <Route path="/roam/*" element={<RoamPage />} />
        <Route path="/search" element={<Search />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdateNotice />
    </>
  )
}
