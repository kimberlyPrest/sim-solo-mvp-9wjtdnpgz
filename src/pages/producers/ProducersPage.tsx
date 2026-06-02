import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducers } from '@/lib/api'
import type { Producer } from '@/lib/mock-data'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, Eye } from 'lucide-react'

export default function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getProducers().then((data) => {
      setProducers(data)
      setLoading(false)
    })
  }, [])

  const filteredProducers = producers.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.document.includes(search),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtores</h1>
          <p className="text-muted-foreground">Gerencie o cadastro de produtores rurais.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Produtor
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome ou CPF/CNPJ..."
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
              <TableHead>CPF / CNPJ</TableHead>
              <TableHead>Total de Fazendas</TableHead>
              <TableHead>Status</TableHead>
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
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredProducers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum produtor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducers.map((producer) => (
                <TableRow key={producer.id}>
                  <TableCell className="font-medium">{producer.name}</TableCell>
                  <TableCell>{producer.document}</TableCell>
                  <TableCell>{producer.totalFarms}</TableCell>
                  <TableCell>
                    <Badge variant={producer.status === 'Ativo' ? 'default' : 'secondary'}>
                      {producer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/produtores/${producer.id}`} title="Visualizar">
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
