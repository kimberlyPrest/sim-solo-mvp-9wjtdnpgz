import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import NotFound from './pages/NotFound'

// Pages
import Index from './pages/Index'
import ProducersPage from './pages/producers/ProducersPage'
import ProducerDetailPage from './pages/producers/ProducerDetailPage'
import FarmsPage from './pages/farms/FarmsPage'
import FarmDetailPage from './pages/farms/FarmDetailPage'
import AreasPage from './pages/areas/AreasPage'
import AreaDetailPage from './pages/areas/AreaDetailPage'
import ImportPage from './pages/import/ImportPage'
import SettingsPage from './pages/settings/SettingsPage'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/produtores" element={<ProducersPage />} />
          <Route path="/produtores/:id" element={<ProducerDetailPage />} />
          <Route path="/fazendas" element={<FarmsPage />} />
          <Route path="/fazendas/:id" element={<FarmDetailPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/areas/:id" element={<AreaDetailPage />} />
          <Route path="/importacao" element={<ImportPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
