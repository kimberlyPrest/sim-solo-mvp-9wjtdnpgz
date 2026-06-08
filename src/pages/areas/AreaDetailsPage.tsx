import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  ArrowLeftRight,
  MapPin,
  Upload,
  Crosshair,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { Tables } from '@/lib/supabase/types'
import { SOIL_ATTRIBUTES } from '@/lib/soil-attributes'
import { GeoMap, classifyPoints, type SoilPointData } from '@/components/map/GeoMap'
import { AreaHistoricalAnalysisTab } from './tabs/AreaHistoricalAnalysisTab'
import { AreaComparisonTab } from './tabs/AreaComparisonTab'
import { AreaRecommendationsTab } from './tabs/AreaRecommendationsTab'
import { GeographicImportWizard } from '@/features/areas/GeographicImportWizard'
import { ImportSoilWizard } from '@/features/soil/ImportSoilWizard'
import { useAuth } from '@/hooks/use-auth'
import { DeleteEntityDialog } from '@/components/DeleteEntityDialog'
import { deleteAreaCascade } from '@/lib/entity-deletion'
import { useToast } from '@/hooks/use-toast'

type AreaDetails = Tables<'areas'> & {
  farms: { name: string; id: string; producers: { name: string } | null } | null
}

type Season = { id: string; season_year: string; crop: string | null }

const DEPTH_OPTIONS = [
  { label: '0-20 cm', from: 0, to: 20, layer: '0_20' },
  { label: '20-40 cm', from: 20, to: 40, layer: '20_40' },
]

const CATEGORY_COLORS = {
  low: '#ef4444',
  medium: '#f97316',
  adequate: '#22c55e',
  high: '#3b82f6',
} as const

const CATEGORY_LABELS = {
  low: 'Baixo',
  medium: 'Medio',
  adequate: 'Adequado',
  high: 'Alto',
} as const

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function DistributionBar({ points }: { points: SoilPointData[] }) {
  const cats = ['low', 'medium', 'adequate', 'high'] as const
  const withCat = points.filter((p) => p.category)
  if (withCat.length === 0) return null

  const counts = cats.reduce(
    (acc, c) => {
      acc[c] = withCat.filter((p) => p.category === c).length
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distribuição</p>
      <div className="flex h-2 rounded-full overflow-hidden">
        {cats.map((cat) => {
          const pct = (counts[cat] / withCat.length) * 100
          if (pct === 0) return null
          return (
            <div
              key={cat}
              style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] }}
              title={`${CATEGORY_LABELS[cat]}: ${counts[cat]}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {cats
          .filter((c) => counts[c] > 0)
          .map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[cat],
                }}
              />
              {counts[cat]} {CATEGORY_LABELS[cat]}
            </span>
          ))}
      </div>
    </div>
  )
}

export default function AreaDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { toast } = useToast()
  const canEdit = hasRole(['admin', 'technician'])

  const [area, setArea] = useState<AreaDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [boundary, setBoundary] = useState<any>(null)
  const [basePoints, setBasePoints] = useState<Omit<SoilPointData, 'category'>[]>([])
  const [pointsForMap, setPointsForMap] = useState<Omit<SoilPointData, 'category'>[]>([])

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')

  const [attributes] = useState<{ code: string; name: string }[]>(SOIL_ATTRIBUTES)
  const [selectedAttribute, setSelectedAttribute] = useState<string>(SOIL_ATTRIBUTES[0]?.code || '')
  const [selectedDepth, setSelectedDepth] = useState<string>('0-20')
  const [pointsLoading, setPointsLoading] = useState(false)
  const [soilRefreshKey, setSoilRefreshKey] = useState(0)

  const [geoWizardOpen, setGeoWizardOpen] = useState(false)
  const [soilWizardOpen, setSoilWizardOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadMapData = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase.rpc('get_area_map_data', { p_area_id: id })
    if (error) return

    const mapData = data as any
    const points = (mapData?.points || []) as Omit<SoilPointData, 'category'>[]
    setBoundary(mapData?.boundary || null)
    setBasePoints(points)
    setPointsForMap(points)
  }, [id])

  useEffect(() => {
    if (!id) return
    async function loadAll() {
      try {
        const [areaRes, seasonRes] = await Promise.all([
          supabase
            .from('areas')
            .select('*, farms(id, name, producers(name))')
            .eq('id', id)
            .single(),
          supabase
            .from('area_seasons')
            .select('id, season_year, crop')
            .eq('area_id', id)
            .order('season_year', { ascending: false }),
        ])

        if (!areaRes.error && areaRes.data) setArea(areaRes.data as any)
        if (!seasonRes.error && seasonRes.data) {
          setSeasons(seasonRes.data)
          setSelectedSeasonId(seasonRes.data[0]?.id || '')
        }
        await loadMapData()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [id, loadMapData])

  useEffect(() => {
    if (!id || !selectedSeasonId || !selectedAttribute) {
      setPointsForMap(basePoints)
      return
    }

    const depthConfig = DEPTH_OPTIONS.find((d) => `${d.from}-${d.to}` === selectedDepth)
    if (!depthConfig) return

    setPointsLoading(true)
    supabase
      .rpc('get_area_points_with_soil_attribute', {
        p_area_id: id,
        p_area_season_id: selectedSeasonId,
        p_attribute_code: selectedAttribute,
        p_depth_layer: depthConfig.layer,
      })
      .then(({ data, error }) => {
        if (!error && data) setPointsForMap(data as any)
        else setPointsForMap(basePoints)
      })
      .finally(() => setPointsLoading(false))
  }, [id, selectedSeasonId, selectedAttribute, selectedDepth, basePoints, soilRefreshKey])

  const coloredPoints = useMemo<SoilPointData[]>(() => {
    if (!pointsForMap.length) return []
    return classifyPoints(pointsForMap)
  }, [pointsForMap])

  const stats = useMemo(() => {
    const vals = coloredPoints.map((p) => p.value).filter((v): v is number => v != null)
    if (vals.length === 0) return null
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    return {
      mean: mean.toFixed(2),
      min: Math.min(...vals).toFixed(2),
      max: Math.max(...vals).toFixed(2),
      n: vals.length,
    }
  }, [coloredPoints])

  const selectedAttrName =
    attributes.find((a) => a.code === selectedAttribute)?.name || selectedAttribute

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId)
  const selectedSeasonLabel = selectedSeason
    ? selectedSeason.crop
      ? `${selectedSeason.season_year} (${selectedSeason.crop})`
      : selectedSeason.season_year
    : ''

  const handleDelete = async () => {
    if (!area) return
    const farmId = area.farms?.id
    setIsDeleting(true)
    try {
      await deleteAreaCascade(area.id)
      toast({ title: 'Sucesso', description: 'Área apagada definitivamente.' })
      navigate(farmId ? `/fazendas/${farmId}` : '/areas')
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground text-sm font-mono">Carregando área...</span>
        </div>
      </div>
    )
  }

  if (!area) return <div className="p-8 text-muted-foreground">Área não encontrada.</div>

  const area_ha = area.calculated_area_ha || area.declared_area_ha

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{area.name}</h1>
            {area_ha && (
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {Number(area_ha).toFixed(2)} ha
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {area.farms && (
              <Link
                to={`/fazendas/${area.farms.id}`}
                className="hover:text-primary transition-colors"
              >
                {area.farms.name}
              </Link>
            )}
            {area.farms?.producers?.name && <> · {area.farms.producers.name}</>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            {!boundary && (
              <Button size="sm" variant="outline" onClick={() => setGeoWizardOpen(true)}>
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Geo</span>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSoilWizardOpen(true)}>
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Solo</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Apagar</span>
            </Button>
          </div>
        )}
      </div>

      {/* Split layout: map + panel */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 520 }}>
        {/* Map */}
        <div
          className="flex-1 min-w-0 relative rounded-xl overflow-hidden border border-border/60"
          style={{ minHeight: 400 }}
        >
          <GeoMap
            boundary={boundary}
            points={coloredPoints.length > 0 ? coloredPoints : undefined}
            tileStyle="dark"
            height="100%"
            showLegend
          />

          <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5 pointer-events-none">
            {selectedSeasonLabel && (
              <div className="bg-background/80 backdrop-blur border border-border/50 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary" />
                <span className="font-mono text-[11px]">{selectedSeasonLabel}</span>
              </div>
            )}
            {coloredPoints.length > 0 && (
              <div className="bg-background/80 backdrop-blur border border-border/50 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                <Crosshair className="h-3 w-3 text-accent" />
                <span className="font-mono text-[11px]">{coloredPoints.length} pontos</span>
              </div>
            )}
            {pointsLoading && (
              <div className="bg-background/80 backdrop-blur border border-border/50 rounded-lg px-2.5 py-1">
                <span className="font-mono text-[11px] text-muted-foreground animate-pulse">
                  Carregando...
                </span>
              </div>
            )}
          </div>

          {!boundary && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90 gap-3 z-[500]">
              <MapPin className="h-10 w-10 opacity-20" />
              <p className="text-sm text-muted-foreground">Sem dados geográficos.</p>
              {canEdit && (
                <Button size="sm" onClick={() => setGeoWizardOpen(true)}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Shapefile
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visualização
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Safra</label>
              {seasons.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-1">Nenhuma safra cadastrada.</p>
              ) : (
                <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs font-mono">
                        {s.crop ? `${s.season_year} (${s.crop})` : s.season_year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Atributo</label>
              <Select value={selectedAttribute} onValueChange={setSelectedAttribute}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {attributes.map((attr) => (
                    <SelectItem key={attr.code} value={attr.code} className="text-xs">
                      {attr.name}
                      <span className="text-muted-foreground ml-1 font-mono">({attr.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Profundidade</label>
              <div className="flex gap-2">
                {DEPTH_OPTIONS.map((d) => {
                  const key = `${d.from}-${d.to}`
                  const active = selectedDepth === key
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDepth(key)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-all border ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/40'
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {stats ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate pr-2">
                  {selectedAttrName}
                </p>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {stats.n} pts
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatPill label="Média" value={stats.mean} />
                <StatPill label="Mín" value={stats.min} />
                <StatPill label="Máx" value={stats.max} />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {Number(stats.max) - Number(stats.min) < 0.5 ? (
                  <>
                    <Minus className="h-3 w-3 text-primary" /> Distribuição uniforme
                  </>
                ) : Number(stats.mean) > (Number(stats.min) + Number(stats.max)) / 2 ? (
                  <>
                    <TrendingUp className="h-3 w-3" style={{ color: '#22c55e' }} /> Concentrado nos
                    valores altos
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" style={{ color: '#f97316' }} /> Concentrado
                    nos valores baixos
                  </>
                )}
              </div>

              <DistributionBar points={coloredPoints} />
            </div>
          ) : seasons.length > 0 && basePoints.length > 0 && !pointsLoading ? (
            <div className="rounded-xl border border-dashed border-border/40 bg-card/50 p-4 flex flex-col items-center gap-2 text-muted-foreground">
              <FlaskConical className="h-7 w-7 opacity-20" />
              <p className="text-xs text-center">Sem dados de solo para este atributo.</p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => setSoilWizardOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Análise
                </Button>
              )}
            </div>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Área
            </p>
            <div className="space-y-1.5 text-xs">
              {area.calculated_area_ha && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calculada</span>
                  <span className="font-mono">{Number(area.calculated_area_ha).toFixed(2)} ha</span>
                </div>
              )}
              {area.source_srid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SRID</span>
                  <span className="font-mono">{area.source_srid}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis tabs */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Tabs defaultValue="history">
          <div className="border-b border-border/60 px-4 pt-4">
            <TabsList className="bg-transparent p-0 gap-1 h-auto">
              <TabsTrigger
                value="history"
                className="text-xs px-3 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md gap-1.5"
              >
                <Activity className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                className="text-xs px-3 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md gap-1.5"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> Comparativo
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="text-xs px-3 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md gap-1.5"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Recomendações
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 sm:p-6">
            <TabsContent value="history" className="mt-0">
              <AreaHistoricalAnalysisTab areaId={id!} />
            </TabsContent>
            <TabsContent value="compare" className="mt-0">
              <AreaComparisonTab areaId={id!} />
            </TabsContent>
            <TabsContent value="recommendations" className="mt-0">
              <AreaRecommendationsTab areaId={id!} canEdit={canEdit} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <GeographicImportWizard
        open={geoWizardOpen}
        onOpenChange={setGeoWizardOpen}
        area={area}
        onSuccess={() => {
          setGeoWizardOpen(false)
          loadMapData()
        }}
      />

      <ImportSoilWizard
        open={soilWizardOpen}
        onOpenChange={setSoilWizardOpen}
        areaId={id!}
        onSuccess={(seasonId, attributeCode) => {
          setSoilWizardOpen(false)
          if (seasonId) setSelectedSeasonId(seasonId)
          if (attributeCode) setSelectedAttribute(attributeCode)
          setSoilRefreshKey((key) => key + 1)
        }}
      />

      <DeleteEntityDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar área"
        description={`Você está prestes a apagar ${area.name}.`}
        details="Também serão apagadas as safras, pontos, análises e recomendações vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
