import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Activity, ClipboardList, Map, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

import { Tables } from '@/lib/supabase/types'
import { AreaHistoricalAnalysisTab } from './tabs/AreaHistoricalAnalysisTab'
import { AreaRecommendationsTab } from './tabs/AreaRecommendationsTab'
import { AreaImportsTab } from './tabs/AreaImportsTab'
import { AreaMapTab } from '@/features/areas/AreaMapTab'
import { SoilAnalysisTab } from '@/features/soil/SoilAnalysisTab'

export default function AreaDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canEdit = hasRole(['admin', 'technician'])

  type AreaDetails = Tables<'areas'> & {
    farms: { name: string; producers: { name: string } | null } | null
  }
  const [area, setArea] = useState<AreaDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadArea() {
      if (!id) return
      try {
        const { data, error } = await supabase
          .from('areas')
          .select(`
            *,
            farms ( name, producers ( name ) )
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        setArea(data as AreaDetails)
      } catch (err: any) {
        console.error('Erro ao carregar área', err)
      } finally {
        setLoading(false)
      }
    }
    loadArea()
  }, [id])

  if (loading) return <div className="p-8">Carregando área...</div>
  if (!area) return <div className="p-8">Área não encontrada.</div>

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{area.name}</h1>
          <p className="text-muted-foreground">
            {area.farms?.name} • {area.farms?.producers?.name}
          </p>
        </div>
      </div>

      <Tabs defaultValue="map" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="h-4 w-4" /> Mapa
          </TabsTrigger>
          <TabsTrigger value="soil" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Análises de Solo
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Recomendações
          </TabsTrigger>
          <TabsTrigger value="imports" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importações
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="map">
            <AreaMapTab area={area} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="soil">
            <SoilAnalysisTab area={area} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="history">
            <AreaHistoricalAnalysisTab areaId={id!} />
          </TabsContent>

          <TabsContent value="recommendations">
            <AreaRecommendationsTab areaId={id!} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="imports">
            <AreaImportsTab areaId={id!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
