import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  Building2,
  ChevronRight,
  Crosshair,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  SlidersHorizontal,
  Tractor,
  Trash2,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProducerForm, ProducerFormData } from './ProducerForm'
import { Tables } from '@/lib/supabase/types'
import { DeleteEntityDialog } from '@/components/DeleteEntityDialog'
import { deleteProducerCascade } from '@/lib/entity-deletion'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FarmForm, FarmFormData } from '../farms/FarmForm'
import { GeoMap, type MapFeature } from '@/components/map/GeoMap'

type FarmAreaSummary = {
  id: string
  name: string
  calculated_area_ha: number | null
  status?: string | null
}

type FarmMapArea = {
  id: string
  name: string
  calculated_area_ha: number | null
  boundary: any | null
  point_count: number
}

type FarmListRow = Tables<'farms'> & {
  areas?: FarmAreaSummary[]
}

type ProducerFarm = FarmListRow & {
  area_count: number
  configured_area_count: number
  point_count: number
  calculated_area_ha: number
  map_areas: FarmMapArea[]
}

const FARM_PALETTE = [
  '#22c55e',
  '#17c4af',
  '#a8e63a',
  '#3b82f6',
  '#f97316',
  '#eab308',
  '#06b6d4',
  '#84cc16',
]

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

function boundaryToFeatures(boundary: any, name: string) {
  if (!boundary) return []
  if (boundary.type === 'FeatureCollection') return boundary.features || []
  if (boundary.type === 'Feature') return [boundary]
  return [{ type: 'Feature', properties: { name }, geometry: boundary }]
}

function farmBoundary(farm: ProducerFarm) {
  const features = farm.map_areas.flatMap((area) => boundaryToFeatures(area.boundary, area.name))
  if (features.length === 0) return null
  if (features.length === 1) return features[0]
  return { type: 'FeatureCollection', features }
}

export default function ProducerDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()
  const [producer, setProducer] = useState<Tables<'producers'> | null>(null)
  const [farms, setFarms] = useState<ProducerFarm[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [farmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isFarmSubmitting, setIsFarmSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)
    setMapLoading(true)
    try {
      const [prodRes, farmsRes] = await Promise.all([
        supabase
          .from('producers')
          .select('*')
          .eq('id', id)
          .eq('organization_id', organization.id)
          .single(),
        supabase
          .from('farms')
          .select('*, areas(id, name, calculated_area_ha, status)')
          .eq('producer_id', id)
          .eq('organization_id', organization.id)
          .order('name'),
      ])

      if (prodRes.error) throw prodRes.error
      if (farmsRes.error) throw farmsRes.error
      if (prodRes.data) setProducer(prodRes.data)

      const rawFarms = (farmsRes.data || []) as any[] as FarmListRow[]
      const mapResults = await Promise.all(
        rawFarms.map(async (farm) => {
          const { data, error } = await supabase.rpc('get_farm_map_data', { p_farm_id: farm.id })
          return {
            farmId: farm.id,
            areas: error ? [] : (((data as any)?.areas || []) as FarmMapArea[]),
          }
        }),
      )
      const mapAreasByFarm = new Map(mapResults.map((result) => [result.farmId, result.areas]))

      const enriched = rawFarms.map((farm) => {
        const activeAreas = (farm.areas || []).filter((area) => area.status !== 'archived')
        const mapAreas = mapAreasByFarm.get(farm.id) || []
        const areaSum = activeAreas.reduce(
          (sum, area) => sum + Number(area.calculated_area_ha || 0),
          0,
        )
        return {
          ...farm,
          area_count: activeAreas.length || mapAreas.length,
          configured_area_count: mapAreas.filter((area) => area.boundary).length,
          point_count: mapAreas.reduce((sum, area) => sum + Number(area.point_count || 0), 0),
          calculated_area_ha: Number(farm.total_area_ha || areaSum || 0),
          map_areas: mapAreas,
        }
      })

      setFarms(enriched)
      if (!selectedFarmId && enriched[0]) setSelectedFarmId(enriched[0].id)
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

  useEffect(() => {
    if (loading || !producer || !canEdit || searchParams.get('setup') !== 'farm') return
    setFarmSheetOpen(true)
    setSearchParams({}, { replace: true })
  }, [canEdit, loading, producer, searchParams, setSearchParams])

  const handleUpdate = async (data: ProducerFormData) => {
    setIsSubmitting(true)
    const { error } = await supabase.from('producers').update(data).eq('id', id)
    setIsSubmitting(false)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Produtor atualizado com sucesso.' })
      setEditSheetOpen(false)
      fetchData()
    }
  }

  const handleCreateFarm = async (data: FarmFormData) => {
    if (!organization || !producer) return
    setIsFarmSubmitting(true)
    try {
      const { data: createdFarm, error } = await supabase
        .from('farms')
        .insert([
          {
            ...data,
            producer_id: producer.id,
            organization_id: organization.id,
            status: 'active',
          },
        ])
        .select('id')
        .single()

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Fazenda criada com sucesso.' })
      setFarmSheetOpen(false)
      if (createdFarm?.id) navigate(`/fazendas/${createdFarm.id}?setup=area`)
      else fetchData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsFarmSubmitting(false)
    }
  }

  const handleArchive = async () => {
    if (!producer) return
    const newStatus = producer.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('producers').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: 'Sucesso',
        description: `Produtor ${newStatus === 'active' ? 'ativado' : 'arquivado'}.`,
      })
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!producer) return
    setIsDeleting(true)
    try {
      await deleteProducerCascade(producer.id)
      toast({ title: 'Sucesso', description: 'Produtor apagado definitivamente.' })
      navigate('/produtores')
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const totalArea = useMemo(
    () => farms.reduce((sum, farm) => sum + Number(farm.calculated_area_ha || 0), 0),
    [farms],
  )
  const totalTalhoes = useMemo(() => farms.reduce((sum, farm) => sum + farm.area_count, 0), [farms])
  const totalPoints = useMemo(() => farms.reduce((sum, farm) => sum + farm.point_count, 0), [farms])

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) || farms[0]

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      farms
        .map((farm, index) => {
          const boundary = farmBoundary(farm)
          if (!boundary) return null
          return {
            id: farm.id,
            name: farm.name,
            boundary,
            color: FARM_PALETTE[index % FARM_PALETTE.length],
          }
        })
        .filter((feature): feature is MapFeature => Boolean(feature)),
    [farms],
  )

  const openFarm = (farmId: string) => {
    setSelectedFarmId(farmId)
    navigate(`/fazendas/${farmId}`)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground text-sm font-mono">Carregando produtor...</span>
        </div>
      </div>
    )
  }

  if (!producer) return <div className="p-8 text-center">Produtor não encontrado.</div>

  return (
    <div className="space-y-5 animate-fade-in-up pb-8">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/produtores')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => setFarmSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova Fazenda
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditSheetOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {producer.status === 'active' ? 'Arquivar' : 'Reativar'}
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
              <Users className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {producer.name}
                </h1>
                <Badge variant={producer.status === 'active' ? 'default' : 'secondary'}>
                  {producer.status === 'active' ? 'Ativo' : 'Arquivado'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {producer.document || 'Documento pendente'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {producer.email || 'E-mail pendente'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {producer.phone || 'Telefone pendente'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hectares</p>
              <p className="font-mono text-lg font-semibold">{formatArea(totalArea)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fazendas</p>
              <p className="font-mono text-lg font-semibold">{farms.length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontos</p>
              <p className="font-mono text-lg font-semibold">{totalPoints}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border border-border/60 bg-card/80 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Fazendas
              </h2>
            </div>
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>

          {farms.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 text-center text-muted-foreground">
              <Tractor className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhuma fazenda vinculada a este produtor.</p>
              {canEdit && (
                <Button size="sm" onClick={() => setFarmSheetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Criar primeira fazenda
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {farms.map((farm, index) => {
                const active = selectedFarm?.id === farm.id
                const color = FARM_PALETTE[index % FARM_PALETTE.length]
                return (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => openFarm(farm.id)}
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
                            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                          />
                          <p className="truncate text-sm font-semibold group-hover:text-primary">
                            {farm.name}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Tractor className="h-3 w-3" /> {formatArea(farm.calculated_area_ha)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {locationLabel(farm)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {farm.area_count} talhao{farm.area_count !== 1 ? 'es' : ''}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-background/50 px-2 py-1">
                        <Crosshair className="h-3 w-3" /> {farm.point_count} pontos
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-background/50 px-2 py-1">
                        <MapPin className="h-3 w-3" /> {farm.configured_area_count} geos
                      </span>
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
              height="100%"
              showLegend={false}
              selectedFeatureId={selectedFarm?.id}
              onFeatureClick={openFarm}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-card text-center text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhuma fazenda com talhoes georreferenciados.</p>
              <p className="max-w-sm text-xs">
                Crie um talhao e conclua a configuracao geografica para ele aparecer no mapa do
                produtor.
              </p>
            </div>
          )}

          <div className="pointer-events-none absolute left-4 top-4 z-30 max-w-sm rounded-lg border border-border/70 bg-background/85 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
              <p className="text-base font-semibold text-primary">Monitoramento Georreferenciado</p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Fazendas mapeadas</span>
                <span className="font-mono text-foreground">{mapFeatures.length}</span>
              </div>
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Talhoes totais</span>
                <span className="font-mono text-foreground">{totalTalhoes}</span>
              </div>
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Area consolidada</span>
                <span className="font-mono text-primary">{formatArea(totalArea)}</span>
              </div>
              {selectedFarm && (
                <div className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">
                  <span className="block truncate text-foreground">{selectedFarm.name}</span>
                  <span className="font-mono">
                    {selectedFarm.area_count} talhoes · {selectedFarm.point_count} pontos
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Editar produtor</SheetTitle>
          </SheetHeader>
          <ProducerForm
            initialData={producer}
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
            onCancel={() => setEditSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={farmSheetOpen} onOpenChange={setFarmSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Nova fazenda para {producer.name}</SheetTitle>
          </SheetHeader>
          <FarmForm
            initialData={{ producer_id: producer.id }}
            producers={[{ id: producer.id, name: producer.name }]}
            onSubmit={handleCreateFarm}
            isSubmitting={isFarmSubmitting}
            onCancel={() => setFarmSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteEntityDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar produtor"
        description={`Voce esta prestes a apagar ${producer.name}.`}
        details="Tambem serao apagadas as fazendas, areas, safras, pontos, analises e recomendacoes vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
