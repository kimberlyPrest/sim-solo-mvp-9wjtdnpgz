import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Archive, Plus, Layers, Calendar, Crosshair, ChevronRight,
  MapPin, FlaskConical, ArrowLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tables } from '@/lib/supabase/types'
import { GeoMap, type MapFeature } from '@/components/map/GeoMap'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FarmForm, FarmFormData } from './FarmForm'

type FarmAreaData = {
  id: string
  name: string
  calculated_area_ha: number | null
  declared_area_ha: number | null
  boundary: any | null
  point_count: number
  last_sample_date: string | null
}

const AREA_PALETTE = [
  '#a8e63a', '#17c4af', '#f97316', '#3b82f6', '#a855f7',
  '#ec4899', '#eab308', '#06b6d4', '#84cc16', '#f43f5e',
]

export default function FarmDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()

  type FarmWithProducer = Tables<'farms'> & { producers: { name: string } | null }
  const [farm, setFarm] = useState<FarmWithProducer | null>(null)
  const [areas, setAreas] = useState<FarmAreaData[]>([])
  const [producers, setProducers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)
    setMapLoading(true)
    try {
      const [farmRes, prodRes] = await Promise.all([
        supabase
          .from('farms')
          .select('*, producers(name)')
          .eq('id', id)
          .eq('organization_id', organization.id)
          .single(),
        supabase.from('producers').select('id, name').eq('organization_id', organization.id),
      ])
      if (farmRes.error) throw farmRes.error
      if (farmRes.data) setFarm(farmRes.data as any)
      if (prodRes.data) setProducers(prodRes.data)

      const mapRes = await supabase.rpc('get_farm_map_data', { p_farm_id: id })
      if (!mapRes.error && mapRes.data) {
        const areasData = (mapRes.data as any).areas as FarmAreaData[] | null
        setAreas(areasData || [])
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Não foi possível carregar os dados.', variant: 'destructive' })
    } finally {
      setLoading(false)
      setMapLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id, organization])

  const handleUpdate = async (data: FarmFormData) => {
    setIsSubmitting(true)
    const { error } = await supabase.from('farms').update(data).eq('id', id)
    setIsSubmitting(false)
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Sucesso', description: 'Fazenda atualizada.' })
      setEditOpen(false)
      fetchData()
    }
  }

  const handleArchive = async () => {
    if (!farm) return
    const newStatus = farm.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('farms').update({ status: newStatus }).eq('id', id)
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Sucesso', description: `Fazenda ${newStatus === 'active' ? 'reativada' : 'arquivada'}.` })
      fetchData()
    }
  }

  const mapFeatures = useMemo<MapFeature[]>(() =>
    areas
      .filter((a) => a.boundary)
      .map((a, i) => ({
        id: a.id,
        name: a.name,
        boundary: a.boundary,
        color: AREA_PALETTE[i % AREA_PALETTE.length],
      })),
    [areas]
  )

  const totalArea = useMemo(() =>
    areas.reduce((sum, a) => sum + (a.calculated_area_ha || a.declared_area_ha || 0), 0),
    [areas]
  )

  const areasWithData = useMemo(() => areas.filter((a) => a.point_count > 0).length, [areas])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground text-sm font-mono">Carregando...</span>
        </div>
      </div>
    )
  }

  if (!farm) return <div className="p-8 text-muted-foreground">Fazenda não encontrada.</div>

  return (
    <div className="space-y-0 animate-fade-in-up pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{farm.name}</h1>
              <Badge variant={farm.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {farm.status === 'active' ? 'Ativo' : 'Arquivado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {farm.producers?.name}
              {farm.city && <> · {farm.city}{farm.state && `, ${farm.state}`}</>}
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Editar</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Editar Fazenda</DialogTitle>
                  </DialogHeader>
                  <FarmForm
                    initialData={farm}
                    producers={producers}
                    onSubmit={handleUpdate}
                    isSubmitting={isSubmitting}
                  />
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-1" />
                {farm.status === 'active' ? 'Arquivar' : 'Reativar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Map Hero */}
      <div className="relative rounded-xl overflow-hidden border border-border/60" style={{ height: 420 }}>
        {mapLoading ? (
          <div className="h-full flex items-center justify-center bg-card text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-mono">Carregando mapa...</span>
            </div>
          </div>
        ) : mapFeatures.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center bg-card text-muted-foreground gap-2">
            <Layers className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum talhão com dados geográficos.</p>
            <p className="text-xs">Importe shapefiles nos detalhes de cada área.</p>
          </div>
        ) : (
          <GeoMap
            features={mapFeatures}
            tileStyle="dark"
            height="420px"
            showLegend={false}
            onFeatureClick={(areaId) => {
              setSelectedAreaId(areaId)
              navigate(`/areas/${areaId}`)
            }}
            selectedFeatureId={selectedAreaId}
          />
        )}

        {/* HUD Overlay */}
        {!mapLoading && (
          <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="flex gap-2">
              <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs text-foreground/90">
                  {areas.length} talhão{areas.length !== 1 ? 'ões' : ''}
                </span>
              </div>
              {totalArea > 0 && (
                <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs text-foreground/90">
                    {totalArea.toFixed(1)} ha
                  </span>
                </div>
              )}
              {areasWithData > 0 && (
                <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-accent" />
                  <span className="font-mono text-xs text-foreground/90">
                    {areasWithData} com análise
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map tip */}
        {mapFeatures.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none">
            <div className="bg-background/70 backdrop-blur border border-border/50 rounded px-2 py-1">
              <span className="text-[10px] font-mono text-muted-foreground">Clique em um talhão para detalhes</span>
            </div>
          </div>
        )}
      </div>

      {/* Area Cards */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Talhões</h2>
          {canEdit && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/areas">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Área
              </Link>
            </Button>
          )}
        </div>

        {areas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 py-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Layers className="h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum talhão cadastrado nesta fazenda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((area, i) => {
              const accentColor = AREA_PALETTE[i % AREA_PALETTE.length]
              const area_ha = area.calculated_area_ha || area.declared_area_ha
              return (
                <Link
                  key={area.id}
                  to={`/areas/${area.id}`}
                  className="group relative rounded-xl border border-border/50 bg-card p-4 hover:border-primary/40 transition-all hover:bg-card/80"
                >
                  {/* Color accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                    style={{ background: accentColor, opacity: 0.8 }}
                  />

                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {area.name}
                      </p>
                      {area_ha ? (
                        <p className="font-mono text-xs text-muted-foreground">{Number(area_ha).toFixed(2)} ha</p>
                      ) : (
                        <p className="font-mono text-xs text-muted-foreground">— ha</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    {area.point_count > 0 ? (
                      <span className="flex items-center gap-1">
                        <Crosshair className="h-3 w-3" style={{ color: accentColor }} />
                        {area.point_count} ponto{area.point_count !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 opacity-40">
                        <Crosshair className="h-3 w-3" />
                        Sem análise
                      </span>
                    )}
                    {area.last_sample_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(area.last_sample_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
