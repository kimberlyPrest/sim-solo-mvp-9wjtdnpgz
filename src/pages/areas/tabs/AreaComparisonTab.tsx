import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, Minus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase/client'
import { SOIL_ATTRIBUTES, SOIL_ATTRIBUTE_COLUMNS } from '@/lib/soil-attributes'
import { GeoMap, type SoilCategory, type SoilPointData } from '@/components/map/GeoMap'

type Season = { id: string; season_year: string; crop: string | null }
type CompareSide = { seasonId: string; attributeCode: string; depthLayer: string }
type BasePoint = Omit<SoilPointData, 'category'>
type ComparisonRow = {
  pointId: string
  pointCode: string
  lat: number
  lng: number
  referenceValue: number | null
  comparisonValue: number | null
  delta: number | null
  deltaPct: number | null
}

const DEPTH_OPTIONS = [
  { label: '0-20 cm', layer: '0_20' },
  { label: '20-40 cm', layer: '20_40' },
]

const DEFAULT_SIDE: CompareSide = {
  seasonId: '',
  attributeCode: SOIL_ATTRIBUTES[0]?.code || '',
  depthLayer: '0_20',
}

function seasonLabel(season?: Season) {
  if (!season) return ''
  return season.crop ? `${season.season_year} (${season.crop})` : season.season_year
}

function attributeLabel(code: string) {
  const attr = SOIL_ATTRIBUTES.find((item) => item.code === code)
  return attr ? `${attr.name} (${attr.code})` : code
}

function valueLabel(value: number | null) {
  return value === null || value === undefined ? '-' : value.toFixed(2)
}

function deltaLabel(value: number | null) {
  if (value === null || value === undefined) return '-'
  if (value === 0) return '0.00'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function pctLabel(value: number | null) {
  if (value === null || value === undefined) return '-'
  if (value === 0) return '0.0%'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function deltaCategory(delta: number | null, maxAbsDelta: number): SoilCategory | undefined {
  if (delta === null || delta === undefined) return undefined
  if (maxAbsDelta === 0 || Math.abs(delta) <= maxAbsDelta * 0.08) return 'adequate'
  if (delta > 0) return 'high'
  return 'low'
}

function SideControls({
  title,
  side,
  seasons,
  onChange,
}: {
  title: string
  side: CompareSide
  seasons: Season[]
  onChange: (next: CompareSide) => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Safra</label>
          <Select
            value={side.seasonId}
            onValueChange={(seasonId) => onChange({ ...side, seasonId })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {seasonLabel(season)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Profundidade</label>
          <Select
            value={side.depthLayer}
            onValueChange={(depthLayer) => onChange({ ...side, depthLayer })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPTH_OPTIONS.map((depth) => (
                <SelectItem key={depth.layer} value={depth.layer}>
                  {depth.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Atributo</label>
          <Select
            value={side.attributeCode}
            onValueChange={(attributeCode) => onChange({ ...side, attributeCode })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOIL_ATTRIBUTES.map((attr) => (
                <SelectItem key={attr.code} value={attr.code}>
                  {attr.name} ({attr.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

async function loadMeasurementValues(side: CompareSide) {
  const column = SOIL_ATTRIBUTE_COLUMNS[side.attributeCode]
  if (!side.seasonId || !side.depthLayer || !column) return new Map<string, number>()

  const { data, error } = await (supabase.from as any)('soil_measurements')
    .select(`sampling_point_id, ${column}`)
    .eq('area_season_id', side.seasonId)
    .eq('depth_layer', side.depthLayer)

  if (error) throw error

  const values = new Map<string, number>()
  ;(data || []).forEach((row: any) => {
    const rawValue = row[column]
    if (rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue))) return
    values.set(row.sampling_point_id, Number(rawValue))
  })
  return values
}

export function AreaComparisonTab({ areaId }: { areaId: string }) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [boundary, setBoundary] = useState<any>(null)
  const [points, setPoints] = useState<BasePoint[]>([])
  const [reference, setReference] = useState<CompareSide>(DEFAULT_SIDE)
  const [comparison, setComparison] = useState<CompareSide>(DEFAULT_SIDE)
  const [rows, setRows] = useState<ComparisonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [comparisonLoading, setComparisonLoading] = useState(false)

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      try {
        const [seasonRes, mapRes] = await Promise.all([
          (supabase.from as any)('area_seasons')
            .select('id, season_year, crop')
            .eq('area_id', areaId)
            .order('season_year', { ascending: false }),
          supabase.rpc('get_area_map_data', { p_area_id: areaId }),
        ])

        if (seasonRes.error) throw seasonRes.error
        if (mapRes.error) throw mapRes.error

        const loadedSeasons = (seasonRes.data || []) as Season[]
        const loadedMap = mapRes.data as any
        const currentSeason = loadedSeasons[0]?.id || ''
        const previousSeason = loadedSeasons[1]?.id || currentSeason

        setSeasons(loadedSeasons)
        setBoundary(loadedMap?.boundary || null)
        setPoints((loadedMap?.points || []) as BasePoint[])
        setReference({ ...DEFAULT_SIDE, seasonId: previousSeason })
        setComparison({ ...DEFAULT_SIDE, seasonId: currentSeason })
      } catch (err) {
        console.error(err)
        setSeasons([])
        setBoundary(null)
        setPoints([])
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [areaId])

  useEffect(() => {
    async function loadComparison() {
      if (!points.length || !reference.seasonId || !comparison.seasonId) {
        setRows([])
        return
      }

      setComparisonLoading(true)
      try {
        const [referenceValues, comparisonValues] = await Promise.all([
          loadMeasurementValues(reference),
          loadMeasurementValues(comparison),
        ])

        setRows(
          points.map((point) => {
            const referenceValue = referenceValues.get(point.id) ?? null
            const comparisonValue = comparisonValues.get(point.id) ?? null
            const delta =
              referenceValue !== null && comparisonValue !== null
                ? comparisonValue - referenceValue
                : null
            const deltaPct =
              delta !== null && referenceValue !== null && referenceValue !== 0
                ? (delta / Math.abs(referenceValue)) * 100
                : null

            return {
              pointId: point.id,
              pointCode: point.code,
              lat: point.lat,
              lng: point.lng,
              referenceValue,
              comparisonValue,
              delta,
              deltaPct,
            }
          }),
        )
      } catch (err) {
        console.error(err)
        setRows([])
      } finally {
        setComparisonLoading(false)
      }
    }

    loadComparison()
  }, [points, reference, comparison])

  const comparedRows = useMemo(() => rows.filter((row) => row.delta !== null), [rows])
  const maxAbsDelta = useMemo(
    () => Math.max(0, ...comparedRows.map((row) => Math.abs(row.delta || 0))),
    [comparedRows],
  )
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0)),
    [rows],
  )
  const mapPoints = useMemo<SoilPointData[]>(
    () =>
      rows
        .filter((row) => row.delta !== null)
        .map((row) => ({
          id: row.pointId,
          code: row.pointCode,
          lat: row.lat,
          lng: row.lng,
          value: row.delta,
          category: deltaCategory(row.delta, maxAbsDelta),
        })),
    [rows, maxAbsDelta],
  )

  const summary = useMemo(() => {
    const referenceValues = comparedRows.map((row) => row.referenceValue as number)
    const comparisonValues = comparedRows.map((row) => row.comparisonValue as number)
    const deltas = comparedRows.map((row) => row.delta as number)
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    const stableLimit = maxAbsDelta * 0.08

    return {
      count: comparedRows.length,
      referenceAvg: avg(referenceValues),
      comparisonAvg: avg(comparisonValues),
      deltaAvg: avg(deltas),
      increased: comparedRows.filter((row) => (row.delta || 0) > stableLimit).length,
      decreased: comparedRows.filter((row) => (row.delta || 0) < -stableLimit).length,
      stable: comparedRows.filter((row) => Math.abs(row.delta || 0) <= stableLimit).length,
      largestIncrease: [...comparedRows].sort((a, b) => (b.delta || 0) - (a.delta || 0))[0],
      largestDecrease: [...comparedRows].sort((a, b) => (a.delta || 0) - (b.delta || 0))[0],
    }
  }, [comparedRows, maxAbsDelta])

  const sameMetric =
    reference.attributeCode === comparison.attributeCode &&
    reference.depthLayer === comparison.depthLayer

  const swapSides = () => {
    setReference(comparison)
    setComparison(reference)
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/20" />
  }

  if (seasons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 py-12 text-center text-muted-foreground">
        Nenhuma safra cadastrada para comparar.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Comparativo personalizado</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Combine safra, profundidade e atributo em cada lado da comparação.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={swapSides} className="shrink-0">
            <ArrowUpDown className="mr-2 h-4 w-4" /> Inverter lados
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
          <SideControls
            title="Referência"
            side={reference}
            seasons={seasons}
            onChange={setReference}
          />
          <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/30 xl:flex">
            <ArrowUpDown className="h-4 w-4 rotate-90 text-muted-foreground" />
          </div>
          <SideControls
            title="Comparação"
            side={comparison}
            seasons={seasons}
            onChange={setComparison}
          />
        </div>

        {!sameMetric && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Você está comparando métricas diferentes. A diferença absoluta aparece para exploração,
            mas a leitura agronômica deve considerar unidade e escala de cada atributo.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pontos comparados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.count}</p>
            <p className="text-xs text-muted-foreground">de {points.length} pontos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Média referência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{valueLabel(summary.referenceAvg)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {attributeLabel(reference.attributeCode)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Média comparação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{valueLabel(summary.comparisonAvg)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {attributeLabel(comparison.attributeCode)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Delta médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                (summary.deltaAvg || 0) > 0
                  ? 'text-blue-500'
                  : (summary.deltaAvg || 0) < 0
                    ? 'text-destructive'
                    : ''
              }`}
            >
              {deltaLabel(summary.deltaAvg)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.increased} subiram · {summary.decreased} caíram · {summary.stable} estáveis
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-border/60">
          <GeoMap boundary={boundary} points={mapPoints} height="420px" showLegend={false} />
          <div className="pointer-events-none absolute left-3 top-3 z-30 flex flex-wrap gap-2">
            <Badge className="bg-blue-500 text-white hover:bg-blue-500">Subiu</Badge>
            <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
              Caiu
            </Badge>
            <Badge className="bg-green-600 text-white hover:bg-green-600">Estável</Badge>
          </div>
          {comparisonLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
              <span className="rounded-md border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground">
                Atualizando comparação...
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Variação por ponto</p>
              <p className="text-xs text-muted-foreground">Ordenado por maior diferença absoluta</p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ponto</TableHead>
                  <TableHead className="text-right">Ref.</TableHead>
                  <TableHead className="text-right">Comp.</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum dado encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => {
                    const direction =
                      row.delta === null
                        ? 'none'
                        : row.delta > 0
                          ? 'up'
                          : row.delta < 0
                            ? 'down'
                            : 'same'
                    return (
                      <TableRow key={row.pointId}>
                        <TableCell className="font-medium">{row.pointCode}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {valueLabel(row.referenceValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {valueLabel(row.comparisonValue)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-xs ${
                            direction === 'up'
                              ? 'text-blue-500'
                              : direction === 'down'
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                          }`}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            {direction === 'up' ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : direction === 'down' ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : direction === 'same' ? (
                              <Minus className="h-3 w-3" />
                            ) : null}
                            {deltaLabel(row.delta)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {pctLabel(row.deltaPct)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
