import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getFarm, getAreas, getProducer } from '@/lib/api'
import type { Farm, Area, Producer } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ArrowLeft, Map, Calendar } from 'lucide-react'

export default function FarmDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [farm, setFarm] = useState<Farm | null>(null)
  const [producer, setProducer] = useState<Producer | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getFarm(id).then((fData) => {
      setFarm(fData || null)
      if (fData) {
        Promise.all([getAreas(id), getProducer(fData.producerId)]).then(([aData, pData]) => {
          setAreas(aData)
          setProducer(pData || null)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })
  }, [id])

  if (loading)
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  if (!farm)
    return <div className="p-6 text-center text-muted-foreground">Fazenda não encontrada.</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/fazendas">Fazendas</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{farm.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/fazendas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{farm.name}</h1>
            <p className="text-muted-foreground">
              {farm.city}, {farm.state} • Produtor: {producer?.name || '...'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {areas.length === 0 ? (
          <div className="col-span-full py-12 text-center border rounded-lg bg-card text-muted-foreground">
            Nenhuma área ou talhão cadastrado.
          </div>
        ) : (
          areas.map((area) => (
            <Card key={area.id} className="overflow-hidden group transition-shadow hover:shadow-md">
              <div className="h-32 bg-muted relative border-b">
                {/* Mock map placeholder */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      'url("https://img.usecurling.com/p/400/200?q=topographic%20map")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Map className="h-8 w-8 text-primary/40" />
                </div>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{area.name}</CardTitle>
                <CardDescription>
                  {area.size} ha • {area.crop}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground mb-4">
                  <Calendar className="mr-1 h-3 w-3" />
                  Última amostragem: {area.lastSampleDate}
                </div>
                <Button className="w-full" variant="secondary" asChild>
                  <Link to={`/areas/${area.id}`}>Ver Prontuário</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
