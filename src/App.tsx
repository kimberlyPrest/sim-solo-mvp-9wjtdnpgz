import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { AppProviders } from './app/Providers'
import NotFound from './pages/NotFound'

// Layout
import { Layout } from './components/layout/Layout'

// Pages
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProducersPage from './pages/producers/ProducersPage'
import FarmsPage from './pages/farms/FarmsPage'
import AreasPage from './pages/areas/AreasPage'
import ImportsPage from './pages/imports/ImportsPage'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AppProviders>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/produtores" element={<ProducersPage />} />
          <Route path="/fazendas" element={<FarmsPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/importacoes" element={<ImportsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppProviders>
  </BrowserRouter>
)

export default App
