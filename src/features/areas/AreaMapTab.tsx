import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { MapIcon, Upload } from 'lucide-react'
import { GeoMap } from '@/components/map/GeoMap'
import { GeographicImportWizard } from './GeographicImportWizard'

export function AreaMapTab({ area, canEdit }: { area: any; canEdit: boolean }) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')
  const [boundary, setBoundary] = useState<any>(null)
  const [points, setPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)

    const { data: camps } = await supabase
      .from('sampling_campaigns')
      .select('id, name, area_seasons!inner(area_id)')
      .eq('area_seasons.area_id', area.id)
      .order('created_at', { ascending: false })

    if (camps) setCampaigns(camps)

    const { data: mapData } = await supabase.rpc('get_area_map_data', { p_area_id: area.id })
    if (mapData && (mapData as any).boundary) {
      setBoundary((mapData as any).boundary)
    }

    setLoading(false)
  }

  const fetchPoints = async (campaignId: string) => {
    if (!campaignId || campaignId === 'all') {
      setPoints([])
      return
    }
    const { data: pts } = await supabase.rpc('get_campaign_points', { p_campaign_id: campaignId })
    if (pts) setPoints(pts as any[])
  }

  useEffect(() => {
    fetchData()
  }, [area.id])

  useEffect(() => {
    fetchPoints(selectedCampaignId)
  }, [selectedCampaignId])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Visualização Geográfica</h2>
        </div>
        {canEdit && (
          <Button onClick={() => setWizardOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Dados Geográficos
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Campanha de Amostragem</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Nenhuma (Apenas contorno)</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações da Área</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área Declarada:</span>
                <span className="font-medium">
                  {area.declared_area_ha ? `${area.declared_area_ha} ha` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área Calculada:</span>
                <span className="font-medium">
                  {area.calculated_area_ha
                    ? `${Number(area.calculated_area_ha).toFixed(2)} ha`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SRID Origem:</span>
                <span className="font-medium">{area.source_srid || '-'}</span>
              </div>
              {selectedCampaignId !== 'all' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pontos de Coleta:</span>
                  <span className="font-medium">{points.length}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="p-1 border shadow-sm">
            {loading ? (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md">
                Carregando mapa...
              </div>
            ) : (
              <GeoMap boundary={boundary} points={points} height="500px" />
            )}
          </Card>
        </div>
      </div>

      <GeographicImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        area={area}
        campaigns={campaigns}
        onSuccess={() => {
          setWizardOpen(false)
          fetchData()
          if (selectedCampaignId !== 'all') fetchPoints(selectedCampaignId)
        }}
      />
    </div>
  )
}
