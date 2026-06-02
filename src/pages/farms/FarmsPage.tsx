import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFarms, getProducers } from '@/lib/api'
import type { Farm, Producer } from '@/lib/mock-data'
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
import { Search, Eye, MapPin } from 'lucide-react'

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [producers, setProducers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([getFarms(), getProducers()]).then(([fData, pData]) => {
      setFarms(fData)
      const pMap = pData.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {})
      setProducers(pMap)
      setLoading(false)
    })
  }, [])

  const filteredFarms = farms.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fazendas</h1>
          <p className="text-muted-foreground">Gestão de propriedades rurais.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome ou cidade..."
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
              <TableHead>Nome</TableHead>
              <TableHead>Produtor Vinculado</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Área Total (ha)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredFarms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma fazenda encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredFarms.map((farm) => (
                <TableRow key={farm.id}>
                  <TableCell className="font-medium">{farm.name}</TableCell>
                  <TableCell>
                    <Link
                      to={`/produtores/${farm.producerId}`}
                      className="hover:underline text-primary"
                    >
                      {producers[farm.producerId] || 'Carregando...'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {farm.city}, {farm.state}
                    </div>
                  </TableCell>
                  <TableCell>{farm.totalArea}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/fazendas/${farm.id}`} title="Visualizar Áreas">
                        <Eye className="h-4 w-4" />
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
