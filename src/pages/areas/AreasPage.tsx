import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAreas, getFarms } from '@/lib/api'
import type { Area, Farm } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronRight } from 'lucide-react'

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [farms, setFarms] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([getAreas(), getFarms()]).then(([aData, fData]) => {
      setAreas(aData)
      const fMap = fData.reduce((acc, f) => ({ ...acc, [f.id]: f.name }), {})
      setFarms(fMap)
      setLoading(false)
    })
  }, [])

  const filteredAreas = areas.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.crop.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Áreas / Talhões</h1>
        <p className="text-muted-foreground">Prontuários e amostragens por talhão.</p>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome ou safra..."
            className="pl-8 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Talhão</TableHead>
              <TableHead>Fazenda</TableHead>
              <TableHead>Área (ha)</TableHead>
              <TableHead>Safra Atual</TableHead>
              <TableHead>Última Amostragem</TableHead>
              <TableHead className="text-right">Prontuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredAreas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma área encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredAreas.map((area) => (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">{area.name}</TableCell>
                  <TableCell>
                    <Link to={`/fazendas/${area.farmId}`} className="hover:underline text-primary">
                      {farms[area.farmId] || 'Carregando...'}
                    </Link>
                  </TableCell>
                  <TableCell>{area.size}</TableCell>
                  <TableCell>{area.crop}</TableCell>
                  <TableCell>{area.lastSampleDate}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/areas/${area.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
