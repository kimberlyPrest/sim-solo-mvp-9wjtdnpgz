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

type ChartRow = { campaign: string; average: number; date: string }

const DEPTHS = [
  { label: '0 - 20 cm', from: 0, to: 20 },
  { label: '20 - 40 cm', from: 20, to: 40 },
]

export function AreaHistoricalAnalysisTab({ areaId }: { areaId: string }) {
  const [attributes, setAttributes] = useState<{ code: string; name: string }[]>([])
  const [selectedAttribute, setSelectedAttribute] = useState<string>('')
  const [selectedDepth, setSelectedDepth] = useState<string>('0-20')
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('lab_attributes')
      .select('code, name')
      .eq('active', true)
      .order('display_order')
      .then(({ data }) => {
        if (data) {
          setAttributes(data)
          if (data.length > 0) setSelectedAttribute(data[0].code)
        }
      })
  }, [])

  useEffect(() => {
    async function loadData() {
      if (!selectedAttribute || !selectedDepth || !areaId) return
      const depthConfig = DEPTHS.find((d) => `${d.from}-${d.to}` === selectedDepth)
      if (!depthConfig) return

      setLoading(true)
      try {
        // Step 1: campaigns for this area (1-level join — works in PostgREST)
        const { data: campaigns, error: campErr } = await supabase
          .from('sampling_campaigns')
          .select('id, name, sample_date, area_seasons!inner(area_id)')
          .eq('area_seasons.area_id', areaId)
        if (campErr) throw campErr
        if (!campaigns?.length) {
          setChartData([])
          return
        }

        // Step 2: sampling point IDs for those campaigns (direct .in filter)
        const campaignIds = campaigns.map((c) => c.id)
        const { data: points, error: ptErr } = await supabase
          .from('sampling_points')
          .select('id, campaign_id')
          .in('campaign_id', campaignIds)
        if (ptErr) throw ptErr
        if (!points?.length) {
          setChartData([])
          return
        }

        // Step 3: measurements filtered by point IDs + depth (1-level join filters)
        const { data: measurements, error: measErr } = await supabase
          .from('lab_measurements')
          .select('numeric_value, samples!inner(depth_from_cm, depth_to_cm, sampling_point_id)')
          .eq('attribute_code', selectedAttribute)
          .eq('samples.depth_from_cm', depthConfig.from)
          .eq('samples.depth_to_cm', depthConfig.to)
          .in(
            'samples.sampling_point_id',
            points.map((p) => p.id),
          )
        if (measErr) throw measErr

        // Aggregate by campaign
        const pointToCampaignId = Object.fromEntries(points.map((p) => [p.id, p.campaign_id]))
        const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]))
        const acc: Record<string, { name: string; total: number; count: number; date: string }> = {}

        measurements?.forEach((m) => {
          const sample = m.samples as any
          const cid = pointToCampaignId[sample.sampling_point_id]
          const camp = campaignById[cid]
          if (!camp) return
          if (!acc[cid])
            acc[cid] = { name: camp.name, total: 0, count: 0, date: camp.sample_date || '' }
          acc[cid].total += Number(m.numeric_value) || 0
          acc[cid].count += 1
        })

        setChartData(
          Object.values(acc)
            .map((c) => ({
              campaign: c.name,
              average: Number((c.total / c.count).toFixed(2)),
              date: c.date,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
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
                <SelectItem key={`${d.from}-${d.to}`} value={`${d.from}-${d.to}`}>
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
              <CardDescription>Média dos pontos por amostragem</CardDescription>
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
                      <XAxis dataKey="campaign" tickLine={false} axisLine={false} tickMargin={10} />
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
              <CardTitle>Valores por Amostragem</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amostragem</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.campaign}</TableCell>
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
