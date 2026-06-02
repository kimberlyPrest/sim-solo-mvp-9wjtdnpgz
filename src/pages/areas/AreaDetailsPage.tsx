import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Activity, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'

import { AreaHistoricalAnalysisTab } from './tabs/AreaHistoricalAnalysisTab'
import { AreaRecommendationsTab } from './tabs/AreaRecommendationsTab'
import { AreaImportsTab } from './tabs/AreaImportsTab'

export default function AreaDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [area, setArea] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadArea() {
      if (!id) return
      const { data } = await supabase
        .from('areas')
        .select(`
          *,
          farms ( name, producers ( name ) )
        `)
        .eq('id', id)
        .single()

      setArea(data)
      setLoading(false)
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

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
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
          <TabsContent value="history">
            <AreaHistoricalAnalysisTab areaId={id!} />
          </TabsContent>

          <TabsContent value="recommendations">
            <AreaRecommendationsTab areaId={id!} />
          </TabsContent>

          <TabsContent value="imports">
            <AreaImportsTab areaId={id!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
