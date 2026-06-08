import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { SOIL_ATTRIBUTES } from '@/lib/soil-attributes'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle } from 'lucide-react'

type ChartRow = { season: string; average: number; date: string }
type SeasonRow = {
  id: string
  season_year: string
  crop: string | null
  sample_date?: string | null
  result_date?: string | null
}

const DEPTHS = [
  { label: '0 - 20 cm', key: '0-20', layer: '0_20' },
  { label: '20 - 40 cm', key: '20-40', layer: '20_40' },
]

const ATTRIBUTE_COLUMNS: Record<string, string> = {
  PH_H2O: 'ph_h2o',
  PH_CACL2: 'ph_cacl2',
  P_REM: 'p_rem',
  MO: 'mo',
  P_MELICH: 'p_melich',
  P_RES: 'p_res',
  K: 'k',
  K_RES: 'k_res',
  S: 's',
  CA: 'ca',
  MG: 'mg',
  AL: 'al',
  H_AL: 'h_al',
  SB: 'sb',
  T: 't_ctc',
  T_EFETIVA: 't_efetiva',
  V: 'v_pct',
  M: 'm_pct',
  B: 'b',
  CU: 'cu',
  FE: 'fe',
  MN: 'mn',
  ZN: 'zn',
  AREIA: 'areia',
  SILTE: 'silte',
  ARGILA: 'argila',
}

function seasonLabel(season: SeasonRow) {
  return season.crop ? `${season.season_year} (${season.crop})` : season.season_year
}

export function AreaHistoricalAnalysisTab({ areaId }: { areaId: string }) {
  const attributes = SOIL_ATTRIBUTES
  const [selectedAttribute, setSelectedAttribute] = useState<string>(SOIL_ATTRIBUTES[0]?.code || '')
  const [selectedDepth, setSelectedDepth] = useState<string>('0-20')
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSelectedAttribute((current) => current || SOIL_ATTRIBUTES[0]?.code || '')
  }, [])

  useEffect(() => {
    async function loadData() {
      if (!selectedAttribute || !selectedDepth || !areaId) return
      const column = ATTRIBUTE_COLUMNS[selectedAttribute]
      const depthConfig = DEPTHS.find((d) => d.key === selectedDepth)
      if (!column || !depthConfig) {
        setChartData([])
        return
      }

      setLoading(true)
      try {
        const { data: seasons, error: seasonsError } = await (supabase.from as any)('area_seasons')
          .select('id, season_year, crop, sample_date, result_date')
          .eq('area_id', areaId)
          .order('season_year', { ascending: true })

        if (seasonsError) throw seasonsError
        if (!seasons?.length) {
          setChartData([])
          return
        }

        const seasonIds = seasons.map((season: SeasonRow) => season.id)
        const { data: measurements, error: measurementsError } = await (supabase.from as any)(
          'soil_measurements',
        )
          .select(`area_season_id, ${column}`)
          .in('area_season_id', seasonIds)
          .eq('depth_layer', depthConfig.layer)

        if (measurementsError) throw measurementsError

        const acc: Record<string, { total: number; count: number }> = {}
        ;(measurements || []).forEach((measurement: any) => {
          const value = measurement[column]
          if (value === null || value === undefined || Number.isNaN(Number(value))) return
          if (!acc[measurement.area_season_id])
            acc[measurement.area_season_id] = { total: 0, count: 0 }
          acc[measurement.area_season_id].total += Number(value)
          acc[measurement.area_season_id].count += 1
        })

        setChartData(
          seasons
            .map((season: SeasonRow) => {
              const values = acc[season.id]
              if (!values?.count) return null
              return {
                season: seasonLabel(season),
                average: Number((values.total / values.count).toFixed(2)),
                date: season.sample_date || season.result_date || season.season_year,
              }
            })
            .filter(Boolean) as ChartRow[],
        )
      } catch (err) {
        console.error(err)
        setChartData([])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [areaId, selectedAttribute, selectedDepth])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-[300px]">
          <label className="text-sm font-medium mb-1 block">Atributo</label>
          <Select value={selectedAttribute} onValueChange={setSelectedAttribute}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {attributes.map((attr) => (
                <SelectItem key={attr.code} value={attr.code}>
                  {attr.name} ({attr.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <label className="text-sm font-medium mb-1 block">Profundidade</label>
          <Select value={selectedDepth} onValueChange={setSelectedDepth}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {DEPTHS.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-xl animate-pulse">
          Carregando...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[400px] flex flex-col items-center justify-center bg-muted/20 rounded-xl text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p>Nenhum dado encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Evolução Média ({selectedAttribute})</CardTitle>
              <CardDescription>Média dos pontos por safra</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ChartContainer
                  config={{ average: { label: 'Média', color: 'hsl(var(--primary))' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="season" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="average"
                        stroke="var(--color-average)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores por Safra</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Safra</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.season}</TableCell>
                      <TableCell className="text-right">{row.average}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
