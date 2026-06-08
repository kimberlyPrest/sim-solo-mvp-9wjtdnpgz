import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Plus,
  Layers,
  Calendar,
  Crosshair,
  ChevronRight,
  MapPin,
  FlaskConical,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tables } from '@/lib/supabase/types'
import { GeoMap, type MapFeature } from '@/components/map/GeoMap'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FarmForm, FarmFormData } from './FarmForm'
import { AreaForm, AreaFormData } from '../areas/AreaForm'
import { DeleteEntityDialog } from '@/components/DeleteEntityDialog'
import { deleteFarmCascade } from '@/lib/entity-deletion'
import { updateFarmLocationFromAreaMajority } from '@/lib/farm-location'

type FarmAreaData = {
  id: string
  name: string
  calculated_area_ha: number | null
  boundary: any | null
  point_count: number
  season_count: number
  measurement_count: number
  recommendation_count: number
  last_sample_date: string | null
}

type AreaStatusStats = Pick<
  FarmAreaData,
  'season_count' | 'measurement_count' | 'recommendation_count' | 'last_sample_date'
>

const AREA_PALETTE = [
  '#a8e63a',
  '#17c4af',
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#eab308',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
]

const EMPTY_STATUS: AreaStatusStats = {
  season_count: 0,
  measurement_count: 0,
  recommendation_count: 0,
  last_sample_date: null,
}

function getAreaStage(area: FarmAreaData) {
  if (!area.boundary) {
    return {
      label: 'Geo pendente',
      description: 'Configurar contorno e pontos',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      icon: CircleDashed,
    }
  }

  if (area.point_count === 0) {
    return {
      label: 'Sem pontos',
      description: 'Revise o shapefile',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      icon: Crosshair,
    }
  }

  if (area.measurement_count === 0) {
    return {
      label: 'Solo pendente',
      description: 'Importar análise laboratorial',
      className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
      icon: FlaskConical,
    }
  }

  if (area.recommendation_count === 0) {
    return {
      label: 'Pronto para recomendação',
      description: 'Análise disponível',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: ClipboardList,
    }
  }

  return {
    label: 'Completo',
    description: 'Recomendação vinculada',
    className: 'border-primary/30 bg-primary/10 text-primary',
    icon: CheckCircle2,
  }
}

function areaHref(area: FarmAreaData) {
  if (!area.boundary) return `/areas/${area.id}?setup=geo`
  if (area.measurement_count === 0) return `/areas/${area.id}?setup=soil`
  return `/areas/${area.id}`
}

export default function FarmDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()

  type FarmWithProducer = Tables<'farms'> & {
    producers: { name: string } | null
    areas?: {
      id: string
      name: string
      calculated_area_ha: number | null
      status?: string | null
    }[]
  }
  const [farm, setFarm] = useState<FarmWithProducer | null>(null)
  const [areas, setAreas] = useState<FarmAreaData[]>([])
  const [producers, setProducers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [areaSheetOpen, setAreaSheetOpen] = useState(false)
  const [isAreaSubmitting, setIsAreaSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  async function loadAreaStatuses(areaIds: string[]): Promise<Record<string, AreaStatusStats>> {
    const statusByArea = Object.fromEntries(areaIds.map((areaId) => [areaId, { ...EMPTY_STATUS }]))
    if (areaIds.length === 0) return statusByArea

    const { data: seasons, error: seasonsError } = await (supabase.from as any)('area_seasons')
      .select('id, area_id, sample_date')
      .in('area_id', areaIds)

    if (seasonsError || !seasons?.length) return statusByArea

    const seasonToArea = new Map<string, string>()
    seasons.forEach((season: any) => {
      seasonToArea.set(season.id, season.area_id)
      const current = statusByArea[season.area_id] || { ...EMPTY_STATUS }
      current.season_count += 1
      if (
        season.sample_date &&
        (!current.last_sample_date || season.sample_date > current.last_sample_date)
      ) {
        current.last_sample_date = season.sample_date
      }
      statusByArea[season.area_id] = current
    })

    const seasonIds = seasons.map((season: any) => season.id)
    const [measurementsRes, recommendationsRes] = await Promise.all([
      (supabase.from as any)('soil_measurements')
        .select('area_season_id')
        .in('area_season_id', seasonIds),
      (supabase.from as any)('recommendation_sets')
        .select('area_season_id')
        .in('area_season_id', seasonIds),
    ])

    if (!measurementsRes.error) {
      ;(measurementsRes.data || []).forEach((row: any) => {
        const areaId = seasonToArea.get(row.area_season_id)
        if (!areaId) return
        statusByArea[areaId].measurement_count += 1
      })
    }

    if (!recommendationsRes.error) {
      ;(recommendationsRes.data || []).forEach((row: any) => {
        const areaId = seasonToArea.get(row.area_season_id)
        if (!areaId) return
        statusByArea[areaId].recommendation_count += 1
      })
    }

    return statusByArea
  }

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)
    setMapLoading(true)
    try {
      const [farmRes, prodRes] = await Promise.all([
        supabase
          .from('farms')
          .select('*, producers(name), areas(id, name, calculated_area_ha, status)')
          .eq('id', id)
          .eq('organization_id', organization.id)
          .single(),
        supabase.from('producers').select('id, name').eq('organization_id', organization.id),
      ])
      if (farmRes.error) throw farmRes.error
      const farmData = farmRes.data as FarmWithProducer
      if (farmData) setFarm(farmData as any)
      if (prodRes.data) setProducers(prodRes.data)

      const baseAreas: FarmAreaData[] = (farmData.areas || [])
        .filter((a) => a.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({
          id: a.id,
          name: a.name,
          calculated_area_ha: a.calculated_area_ha,
          boundary: null,
          point_count: 0,
          ...EMPTY_STATUS,
        }))

      const statusByArea = await loadAreaStatuses(baseAreas.map((area) => area.id))
      const allAreas = baseAreas.map((area) => ({
        ...area,
        ...(statusByArea[area.id] || EMPTY_STATUS),
      }))

      const mapRes = await supabase.rpc('get_farm_map_data', { p_farm_id: id })
      if (!mapRes.error && mapRes.data) {
        const mapAreas = ((mapRes.data as any).areas as FarmAreaData[] | null) || []
        const mapById = Object.fromEntries(mapAreas.map((a) => [a.id, a]))
        const merged = allAreas.map((a) =>
          mapById[a.id]
            ? {
                ...a,
                boundary: mapById[a.id].boundary,
                point_count: mapById[a.id].point_count,
                last_sample_date: mapById[a.id].last_sample_date ?? a.last_sample_date,
                calculated_area_ha: mapById[a.id].calculated_area_ha ?? a.calculated_area_ha,
              }
            : a,
        )
        setAreas(merged)

        if (canEdit && merged.some((area) => area.boundary)) {
          updateFarmLocationFromAreaMajority(id)
            .then((location) => {
              if (!location) return
              if (farmData.city === location.city && farmData.state === location.state) return
              setFarm((current) =>
                current ? { ...current, city: location.city, state: location.state } : current,
              )
            })
            .catch(() => {})
        }
      } else {
        setAreas(allAreas)
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setMapLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id, organization])

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

  const handleCreateArea = async (data: AreaFormData) => {
    if (!organization || !id) return
    setIsAreaSubmitting(true)
    try {
      const { data: createdArea, error } = await supabase
        .from('areas')
        .insert([
          {
            farm_id: id,
            name: data.name,
            notes: data.notes || null,
            organization_id: organization.id,
            status: 'active',
          },
        ])
        .select('id')
        .single()

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Talhão criado com sucesso.' })
      setAreaSheetOpen(false)
      if (createdArea?.id) navigate(`/areas/${createdArea.id}?setup=geo`)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsAreaSubmitting(false)
    }
  }

  const handleArchive = async () => {
    if (!farm) return
    const newStatus = farm.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('farms').update({ status: newStatus }).eq('id', id)
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else {
      toast({
        title: 'Sucesso',
        description: `Fazenda ${newStatus === 'active' ? 'reativada' : 'arquivada'}.`,
      })
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!farm) return
    setIsDeleting(true)
    try {
      await deleteFarmCascade(farm.id)
      toast({ title: 'Sucesso', description: 'Fazenda apagada definitivamente.' })
      navigate('/fazendas')
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      areas
        .filter((a) => a.boundary)
        .map((a, i) => ({
          id: a.id,
          name: a.name,
          boundary: a.boundary,
          color: AREA_PALETTE[i % AREA_PALETTE.length],
        })),
    [areas],
  )

  const totalArea = useMemo(
    () => areas.reduce((sum, a) => sum + (a.calculated_area_ha || 0), 0),
    [areas],
  )

  const configuredAreas = useMemo(() => areas.filter((a) => a.boundary).length, [areas])
  const areasWithData = useMemo(() => areas.filter((a) => a.measurement_count > 0).length, [areas])
  const completeAreas = useMemo(
    () => areas.filter((a) => a.recommendation_count > 0).length,
    [areas],
  )

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
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{farm.name}</h1>
              <Badge
                variant={farm.status === 'active' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {farm.status === 'active' ? 'Ativo' : 'Arquivado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {farm.producers?.name}
              {farm.city && (
                <>
                  {' '}
                  · {farm.city}
                  {farm.state && `, ${farm.state}`}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <>
              <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Talhão
              </Button>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
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
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Apagar
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className="relative rounded-xl overflow-hidden border border-border/60"
        style={{ height: 420 }}
      >
        {mapLoading ? (
          <div className="h-full flex items-center justify-center bg-card text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-mono">Carregando mapa...</span>
            </div>
          </div>
        ) : mapFeatures.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center bg-card text-muted-foreground gap-3">
            <Layers className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum talhão configurado no mapa.</p>
            {canEdit && (
              <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeiro talhão
              </Button>
            )}
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

        {!mapLoading && (
          <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="flex flex-wrap gap-2">
              <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs text-foreground/90">
                  {areas.length} talhão{areas.length !== 1 ? 'ões' : ''}
                </span>
              </div>
              <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs text-foreground/90">{configuredAreas} geo</span>
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
                    {areasWithData} com solo
                  </span>
                </div>
              )}
              {completeAreas > 0 && (
                <div className="bg-background/80 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs text-foreground/90">
                    {completeAreas} completos
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {mapFeatures.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none">
            <div className="bg-background/70 backdrop-blur border border-border/50 rounded px-2 py-1">
              <span className="text-[10px] font-mono text-muted-foreground">
                Clique em um talhão para detalhes
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Talhões
          </h2>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setAreaSheetOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Talhão
            </Button>
          )}
        </div>

        {areas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Layers className="h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum talhão cadastrado nesta fazenda.</p>
            {canEdit && (
              <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar talhão
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((area, i) => {
              const accentColor = AREA_PALETTE[i % AREA_PALETTE.length]
              const area_ha = area.calculated_area_ha
              const stage = getAreaStage(area)
              const StageIcon = stage.icon
              return (
                <Link
                  key={area.id}
                  to={areaHref(area)}
                  className="group relative rounded-xl border border-border/50 bg-card p-4 hover:border-primary/40 transition-all hover:bg-card/80"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                    style={{ background: accentColor, opacity: 0.8 }}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {area.name}
                      </p>
                      {area_ha ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          {Number(area_ha).toFixed(2)} ha
                        </p>
                      ) : (
                        <p className="font-mono text-xs text-muted-foreground">Área a calcular</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                  </div>

                  <div className={`mt-3 rounded-lg border px-2.5 py-2 ${stage.className}`}>
                    <div className="flex items-center gap-1.5">
                      <StageIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-medium truncate">{stage.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-80">{stage.description}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Crosshair className="h-3 w-3" style={{ color: accentColor }} />
                      {area.point_count} ponto{area.point_count !== 1 ? 's' : ''}
                    </span>
                    {area.measurement_count > 0 && (
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        Solo importado
                      </span>
                    )}
                    {area.last_sample_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(area.last_sample_date).toLocaleDateString('pt-BR', {
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={areaSheetOpen} onOpenChange={setAreaSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Novo talhão em {farm.name}</SheetTitle>
          </SheetHeader>
          <AreaForm
            initialData={{ farm_id: farm.id }}
            farms={[{ id: farm.id, name: farm.name }]}
            onSubmit={handleCreateArea}
            isSubmitting={isAreaSubmitting}
            onCancel={() => setAreaSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteEntityDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar fazenda"
        description={`Você está prestes a apagar ${farm.name}.`}
        details="Também serão apagadas as áreas, safras, pontos, análises e recomendações vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
