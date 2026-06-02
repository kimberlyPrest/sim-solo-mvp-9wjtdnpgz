import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Loader2 } from 'lucide-react'

export function SoilAnalysisList({ campaigns }: any) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [selectedDepth, setSelectedDepth] = useState<string>('all')
  const [selectedSample, setSelectedSample] = useState<any>(null)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      let query = supabase.from('sampling_points').select(`
        id, code, campaign_id,
        samples!inner(
          id, depth_from_cm, depth_to_cm,
          lab_measurements(attribute_code, numeric_value)
        )
      `)

      if (selectedCampaign !== 'all') {
        query = query.eq('campaign_id', selectedCampaign)
      } else if (campaigns?.length > 0) {
        query = query.in(
          'campaign_id',
          campaigns.map((c: any) => c.id),
        )
      } else {
        setData([])
        return
      }

      const { data: res, error } = await query
      if (error) throw error

      const rows: any[] = []
      res?.forEach((point) => {
        point.samples.forEach((sample: any) => {
          const depthKey = `${sample.depth_from_cm}-${sample.depth_to_cm}`
          if (selectedDepth !== 'all' && depthKey !== selectedDepth) return

          const measures = sample.lab_measurements || []
          const getVal = (code: string) =>
            measures.find((m: any) => m.attribute_code === code)?.numeric_value || '-'

          rows.push({
            point_id: point.id,
            point_code: point.code,
            depth: depthKey,
            ph: getVal('PH_H2O'),
            mo: getVal('MO'),
            p: getVal('P_MELICH'),
            k: getVal('K'),
            v: getVal('V'),
            measurements: measures,
          })
        })
      })
      setData(rows.sort((a, b) => a.point_code.localeCompare(b.point_code)))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (campaigns && campaigns.length > 0) fetchData()

    const onRefresh = () => fetchData()
    window.addEventListener('refresh-soil-analyses', onRefresh)
    return () => window.removeEventListener('refresh-soil-analyses', onRefresh)
  }, [selectedCampaign, selectedDepth, campaigns])

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">Nenhuma campanha encontrada.</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Campanhas</SelectItem>
            {campaigns.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDepth} onValueChange={setSelectedDepth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Profundidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Profundidades</SelectItem>
            <SelectItem value="0-20">0 - 20 cm</SelectItem>
            <SelectItem value="20-40">20 - 40 cm</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ponto</TableHead>
              <TableHead>Prof. (cm)</TableHead>
              <TableHead>pH (H2O)</TableHead>
              <TableHead>MO</TableHead>
              <TableHead>P (Mehlich)</TableHead>
              <TableHead>K</TableHead>
              <TableHead>V%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma análise encontrada.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow
                  key={i}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedSample(row)}
                >
                  <TableCell className="font-medium">{row.point_code}</TableCell>
                  <TableCell>{row.depth}</TableCell>
                  <TableCell>{row.ph}</TableCell>
                  <TableCell>{row.mo}</TableCell>
                  <TableCell>{row.p}</TableCell>
                  <TableCell>{row.k}</TableCell>
                  <TableCell>{row.v}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer open={!!selectedSample} onOpenChange={(o) => !o && setSelectedSample(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Ponto {selectedSample?.point_code}</DrawerTitle>
              <DrawerDescription>Profundidade: {selectedSample?.depth} cm</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atributo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSample?.measurements.map((m: any) => (
                    <TableRow key={m.attribute_code}>
                      <TableCell className="font-medium">{m.attribute_code}</TableCell>
                      <TableCell>{m.numeric_value}</TableCell>
                    </TableRow>
                  ))}
                  {selectedSample?.measurements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center">
                        Nenhum dado laboratorial
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
