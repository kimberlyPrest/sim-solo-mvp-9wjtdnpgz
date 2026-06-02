import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProducer, getFarms } from '@/lib/api'
import type { Producer, Farm } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ArrowLeft, MapPin, Eye } from 'lucide-react'

export default function ProducerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [producer, setProducer] = useState<Producer | null>(null)
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getProducer(id), getFarms(id)]).then(([pData, fData]) => {
      setProducer(pData || null)
      setFarms(fData)
      setLoading(false)
    })
  }, [id])

  if (loading)
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  if (!producer)
    return <div className="p-6 text-center text-muted-foreground">Produtor não encontrado.</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/produtores">Produtores</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{producer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/produtores">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{producer.name}</h1>
            <p className="text-muted-foreground">CPF/CNPJ: {producer.document}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fazendas Vinculadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Fazenda</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Área Total (ha)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhuma fazenda vinculada.
                    </TableCell>
                  </TableRow>
                ) : (
                  farms.map((farm) => (
                    <TableRow key={farm.id}>
                      <TableCell className="font-medium">{farm.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {farm.city}, {farm.state}
                        </div>
                      </TableCell>
                      <TableCell>{farm.totalArea}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/fazendas/${farm.id}`}>
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
        </CardContent>
      </Card>
    </div>
  )
}
