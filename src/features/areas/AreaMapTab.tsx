import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapIcon, Upload } from 'lucide-react'
import { GeoMap } from '@/components/map/GeoMap'
import { GeographicImportWizard } from './GeographicImportWizard'

export function AreaMapTab({ area, canEdit }: { area: any; canEdit: boolean }) {
  const [boundary, setBoundary] = useState<any>(null)
  const [points, setPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [mapRes, campRes] = await Promise.all([
      supabase.rpc('get_area_map_data', { p_area_id: area.id }),
      supabase
        .from('sampling_campaigns')
        .select('id, area_seasons!inner(area_id)')
        .eq('area_seasons.area_id', area.id)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    if (mapRes.data?.boundary) setBoundary(mapRes.data.boundary)

    if (campRes.data?.[0]) {
      const { data: pts } = await supabase.rpc('get_campaign_points', {
        p_campaign_id: campRes.data[0].id,
      })
      if (pts) setPoints(pts as any[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [area.id])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Visualização Geográfica</h2>
          {points.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              ({points.length} pontos)
            </span>
          )}
        </div>
        {canEdit && (
          <Button onClick={() => setWizardOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Dados Geográficos
          </Button>
        )}
      </div>

      <Card className="p-1 border shadow-sm">
        {loading ? (
          <div className="h-[500px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md">
            Carregando mapa...
          </div>
        ) : (
          <GeoMap boundary={boundary} points={points} height="500px" />
        )}
      </Card>

      <GeographicImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        area={area}
        onSuccess={() => {
          setWizardOpen(false)
          fetchData()
        }}
      />
    </div>
  )
}
