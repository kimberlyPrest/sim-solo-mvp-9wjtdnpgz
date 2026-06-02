import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getArea, getFarm, getSamples } from '@/lib/api'
import type { Area, Farm, Sample } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ArrowLeft, Download, Map as MapIcon, Layers } from 'lucide-react'

export default function AreaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [area, setArea] = useState<Area | null>(null)
  const [farm, setFarm] = useState<Farm | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getArea(id).then((aData) => {
      setArea(aData || null)
      if (aData) {
        Promise.all([getFarm(aData.farmId), getSamples(id)]).then(([fData, sData]) => {
          setFarm(fData || null)
          setSamples(sData)
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
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  if (!area)
    return <div className="p-6 text-center text-muted-foreground">Área não encontrada.</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/fazendas/${area.farmId}`}>{farm?.name || 'Fazenda'}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{area.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to={`/fazendas/${area.farmId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prontuário: {area.name}</h1>
            <p className="text-muted-foreground">
              Área: {area.size} ha • Safra: {area.crop}
            </p>
          </div>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar Dados
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5" /> Georreferência
              </CardTitle>
              <CardDescription>Polígono da área (Pré-visualização)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-square w-full rounded-md bg-muted relative overflow-hidden border">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'url("https://img.usecurling.com/p/600/600?q=satellite%20farm%20field&color=green")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Mock Polygon overlay */}
                <div className="absolute inset-4 border-2 border-primary bg-primary/20 rounded-sm" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="amostragens" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="amostragens">Amostragens (Laboratório)</TabsTrigger>
              <TabsTrigger value="recomendacoes">Recomendações Técnicas</TabsTrigger>
            </TabsList>
            <TabsContent value="amostragens" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resultados Analíticos</CardTitle>
                  <CardDescription>Última campanha: {area.lastSampleDate}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[100px]">Profundidade</TableHead>
                          <TableHead>pH (CaCl2)</TableHead>
                          <TableHead>P (mg/dm³)</TableHead>
                          <TableHead>K (mg/dm³)</TableHead>
                          <TableHead>Ca (cmolc/dm³)</TableHead>
                          <TableHead>Mg (cmolc/dm³)</TableHead>
                          <TableHead>MO (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {samples.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Sem dados de laboratório.
                            </TableCell>
                          </TableRow>
                        ) : (
                          samples.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" /> {s.depth}
                              </TableCell>
                              <TableCell>{s.ph}</TableCell>
                              <TableCell>{s.p}</TableCell>
                              <TableCell>{s.k}</TableCell>
                              <TableCell>{s.ca}</TableCell>
                              <TableCell>{s.mg}</TableCell>
                              <TableCell>{s.mo}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="recomendacoes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Recomendações</CardTitle>
                  <CardDescription>Prescrições cadastradas por técnicos.</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground border-t border-dashed">
                  Nenhuma recomendação técnica cadastrada para esta safra.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
