import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Crosshair,
  FlaskConical,
  Layers,
  MapPin,
  Pencil,
  Plus,
  SlidersHorizontal,
  Tractor,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tables } from '@/lib/supabase/types'
import { GeoMap, type MapFeature } from '@/components/map/GeoMap'
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

function formatArea(value: number | null | undefined) {
  if (!value) return '-'
  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ha`
}

function locationLabel(farm: Pick<Tables<'farms'>, 'city' | 'state'>) {
  if (!farm.city && !farm.state) return 'Localizacao pendente'
  if (farm.city && farm.state) return `${farm.city}, ${farm.state}`
  return farm.city || farm.state || 'Localizacao pendente'
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
      description: 'Importar analise laboratorial',
      className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
      icon: FlaskConical,
    }
  }

  if (area.recommendation_count === 0) {
    return {
      label: 'Pronto para recomendacao',
      description: 'Analise disponivel',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: ClipboardList,
    }
  }

  return {
    label: 'Completo',
    description: 'Recomendacao vinculada',
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
  const [searchParams, setSearchParams] = useSearchParams()
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
        if (!selectedAreaId && merged[0]) setSelectedAreaId(merged[0].id)

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
        if (!selectedAreaId && allAreas[0]) setSelectedAreaId(allAreas[0].id)
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os dados.',
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

  useEffect(() => {
    if (loading || !farm || !canEdit || searchParams.get('setup') !== 'area') return
    setAreaSheetOpen(true)
    setSearchParams({}, { replace: true })
  }, [canEdit, farm, loading, searchParams, setSearchParams])

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
      toast({ title: 'Sucesso', description: 'Talhao criado com sucesso.' })
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

  const openArea = (area: FarmAreaData) => {
    setSelectedAreaId(area.id)
    navigate(areaHref(area))
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
  const totalPoints = useMemo(
    () => areas.reduce((sum, area) => sum + Number(area.point_count || 0), 0),
    [areas],
  )
  const areasWithData = useMemo(() => areas.filter((a) => a.measurement_count > 0).length, [areas])
  const completeAreas = useMemo(
    () => areas.filter((a) => a.recommendation_count > 0).length,
    [areas],
  )
  const selectedArea = areas.find((area) => area.id === selectedAreaId) || areas[0]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground text-sm font-mono">Carregando fazenda...</span>
        </div>
      </div>
    )
  }

  if (!farm) return <div className="p-8 text-muted-foreground">Fazenda nao encontrada.</div>

  return (
    <div className="space-y-5 animate-fade-in-up pb-8">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo Talhao
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {farm.status === 'active' ? 'Arquivar' : 'Reativar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Apagar
            </Button>
          </div>
        )}
      </div>

      <section className="relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-4 sm:p-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50 text-primary shadow-inner">
              <Tractor className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {farm.name}
                </h1>
                <Badge variant={farm.status === 'active' ? 'default' : 'secondary'}>
                  {farm.status === 'active' ? 'Ativo' : 'Arquivado'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Tractor className="h-3.5 w-3.5" /> {farm.producers?.name || 'Produtor pendente'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {locationLabel(farm)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:min-w-[460px]">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hectares</p>
              <p className="font-mono text-lg font-semibold">{formatArea(totalArea)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Talhoes</p>
              <p className="font-mono text-lg font-semibold">{areas.length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontos</p>
              <p className="font-mono text-lg font-semibold">{totalPoints}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Solo</p>
              <p className="font-mono text-lg font-semibold">{areasWithData}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border border-border/60 bg-card/80 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Talhoes
              </h2>
            </div>
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>

          {areas.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 text-center text-muted-foreground">
              <Layers className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhum talhao cadastrado nesta fazenda.</p>
              {canEdit && (
                <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Criar primeiro talhao
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {areas.map((area, index) => {
                const accentColor = AREA_PALETTE[index % AREA_PALETTE.length]
                const stage = getAreaStage(area)
                const StageIcon = stage.icon
                const active = selectedArea?.id === area.id
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => openArea(area)}
                    className={`group w-full rounded-lg border p-3 text-left transition-all ${
                      active
                        ? 'border-primary/70 bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]'
                        : 'border-border/40 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                          />
                          <p className="truncate text-sm font-semibold group-hover:text-primary">
                            {area.name}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Layers className="h-3 w-3" /> {formatArea(area.calculated_area_ha)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Crosshair className="h-3 w-3" /> {area.point_count} pontos
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>

                    <div className={`mt-3 rounded-lg border px-2.5 py-2 ${stage.className}`}>
                      <div className="flex items-center gap-1.5">
                        <StageIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-xs font-medium">{stage.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] opacity-80">{stage.description}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {area.measurement_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background/50 px-2 py-1">
                          <FlaskConical className="h-3 w-3" /> Solo importado
                        </span>
                      )}
                      {area.last_sample_date && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-background/50 px-2 py-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(area.last_sample_date).toLocaleDateString('pt-BR', {
                            month: 'short',
                            year: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section
          className="relative min-h-[560px] overflow-hidden rounded-xl border border-border/60 bg-card"
          style={{ height: 'min(72vh, 720px)' }}
        >
          {mapLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-mono">Carregando mapa...</span>
              </div>
            </div>
          ) : mapFeatures.length > 0 ? (
            <GeoMap
              features={mapFeatures}
              tileStyle="roadmap"
              height="100%"
              showLegend={false}
              onFeatureClick={(areaId) => {
                const area = areas.find((item) => item.id === areaId)
                if (area) openArea(area)
              }}
              selectedFeatureId={selectedArea?.id}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-card text-center text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhum talhao configurado no mapa.</p>
              <p className="max-w-sm text-xs">
                Crie um talhao e conclua a configuracao geografica para ele aparecer no mapa da
                fazenda.
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => setAreaSheetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Criar talhao
                </Button>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute left-16 right-4 top-4 z-30 rounded-lg border border-border/70 bg-background/85 p-4 backdrop-blur sm:left-auto sm:max-w-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
              <p className="text-base font-semibold text-primary">Monitoramento da Fazenda</p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Talhoes mapeados</span>
                <span className="font-mono text-foreground">{configuredAreas}</span>
              </div>
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Pontos de coleta</span>
                <span className="font-mono text-foreground">{totalPoints}</span>
              </div>
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Area consolidada</span>
                <span className="font-mono text-primary">{formatArea(totalArea)}</span>
              </div>
              {selectedArea && (
                <div className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">
                  <span className="block truncate text-foreground">{selectedArea.name}</span>
                  <span className="font-mono">
                    {selectedArea.point_count} pontos · {getAreaStage(selectedArea).label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Editar fazenda</SheetTitle>
          </SheetHeader>
          <FarmForm
            initialData={farm}
            producers={producers}
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
            onCancel={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={areaSheetOpen} onOpenChange={setAreaSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Novo talhao em {farm.name}</SheetTitle>
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
        description={`Voce esta prestes a apagar ${farm.name}.`}
        details="Tambem serao apagadas as areas, safras, pontos, analises e recomendacoes vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
