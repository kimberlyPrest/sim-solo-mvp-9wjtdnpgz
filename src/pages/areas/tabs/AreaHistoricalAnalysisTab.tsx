import { useState, useEffect, useMemo } from 'react'
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

export function AreaHistoricalAnalysisTab({ areaId }: { areaId: string }) {
  const [attributes, setAttributes] = useState<any[]>([])
  const [selectedAttribute, setSelectedAttribute] = useState<string>('')
  const [selectedDepth, setSelectedDepth] = useState<string>('0-20')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const depths = [
    { label: '0 - 20 cm', from: 0, to: 20 },
    { label: '20 - 40 cm', from: 20, to: 40 },
  ]

  useEffect(() => {
    async function loadAttributes() {
      const { data } = await supabase
        .from('lab_attributes')
        .select('code, name')
        .eq('active', true)
        .order('display_order')
      if (data) {
        setAttributes(data)
        if (data.length > 0) setSelectedAttribute(data[0].code)
      }
    }
    loadAttributes()
  }, [])

  useEffect(() => {
    async function loadData() {
      if (!selectedAttribute || !selectedDepth || !areaId) return
      setLoading(true)
      const depthConfig = depths.find((d) => `${d.from}-${d.to}` === selectedDepth)
      if (!depthConfig) return

      try {
        const { data: rawData, error } = await supabase
          .from('lab_measurements')
          .select(`
            numeric_value,
            samples!inner(
              depth_from_cm,
              depth_to_cm,
              sampling_points!inner(
                code,
                sampling_campaigns!inner(
                  name,
                  sample_date,
                  area_seasons!inner(
                    area_id
                  )
                )
              )
            )
          `)
          .eq('attribute_code', selectedAttribute)
          .eq('samples.depth_from_cm', depthConfig.from)
          .eq('samples.depth_to_cm', depthConfig.to)
          .eq('samples.sampling_points.sampling_campaigns.area_seasons.area_id', areaId)

        if (error) throw error
        setData(rawData || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [areaId, selectedAttribute, selectedDepth])

  const chartData = useMemo(() => {
    if (!data.length) return []

    const byCampaign: Record<string, { name: string; total: number; count: number; date: string }> =
      {}

    data.forEach((item) => {
      const campaign = item.samples.sampling_points.sampling_campaigns
      const campaignName = campaign.name
      const val = item.numeric_value || 0

      if (!byCampaign[campaignName]) {
        byCampaign[campaignName] = {
          name: campaignName,
          total: 0,
          count: 0,
          date: campaign.sample_date || '',
        }
      }
      byCampaign[campaignName].total += val
      byCampaign[campaignName].count += 1
    })

    return Object.values(byCampaign)
      .map((c) => ({
        campaign: c.name,
        average: Number((c.total / c.count).toFixed(2)),
        date: c.date || '',
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

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
              {depths.map((d) => (
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
              <CardDescription>Média dos pontos por campanha</CardDescription>
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
              <CardTitle>Valores por Campanha</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
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
