import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Archive, Calendar, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AreaForm, AreaFormData } from './AreaForm'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SeasonForm, SeasonFormData } from './SeasonForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AreaMapTab } from '@/features/areas/AreaMapTab'
import { SoilAnalysisTab } from '@/features/soil/SoilAnalysisTab'

export default function AreaDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()

  const [area, setArea] = useState<any>(null)
  const [farms, setFarms] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSeasonSheetOpen, setIsSeasonSheetOpen] = useState(false)
  const [isSubmittingSeason, setIsSubmittingSeason] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)

    const [areaRes, farmsRes, seasonsRes] = await Promise.all([
      supabase
        .from('areas')
        .select('*, farms(id, name, producers(id, name))')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .single(),
      supabase.from('farms').select('id, name').eq('organization_id', organization.id),
      supabase
        .from('area_seasons')
        .select('*')
        .eq('area_id', id)
        .eq('organization_id', organization.id)
        .order('season_year', { ascending: false }),
    ])

    if (areaRes.data) setArea(areaRes.data)
    if (farmsRes.data) setFarms(farmsRes.data)
    if (seasonsRes.data) setSeasons(seasonsRes.data)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id, organization])

  const handleUpdate = async (data: AreaFormData) => {
    setIsSubmitting(true)
    const { error } = await supabase
      .from('areas')
      .update({
        name: data.name,
        farm_id: data.farm_id,
        declared_area_ha: data.declared_area_ha,
        notes: data.notes,
      })
      .eq('id', id)
    setIsSubmitting(false)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Área atualizada com sucesso.' })
      fetchData()
    }
  }

  const handleArchive = async () => {
    const newStatus = area.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('areas').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: 'Sucesso',
        description: `Área ${newStatus === 'active' ? 'ativada' : 'arquivada'}.`,
      })
      fetchData()
    }
  }

  const handleCreateSeason = async (data: SeasonFormData) => {
    if (!organization || !id) return
    setIsSubmittingSeason(true)
    const { error } = await supabase.from('area_seasons').insert([
      {
        ...data,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        area_id: id,
        organization_id: organization.id,
      },
    ])
    setIsSubmittingSeason(false)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Safra criada com sucesso.' })
      setIsSeasonSheetOpen(false)
      fetchData()
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>
  if (!area) return <div className="p-8 text-center">Área não encontrada.</div>

  const farm = area.farms
  const producer = farm?.producers

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          {producer && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/produtores">Produtores</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/produtores/${producer.id}`}>{producer.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {farm && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/fazendas/${farm.id}`}>{farm.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{area.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{area.name}</h1>
          <Badge variant={area.status === 'active' ? 'default' : 'secondary'}>
            {area.status === 'active' ? 'Ativo' : 'Arquivado'}
          </Badge>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            {area.status === 'active' ? 'Arquivar Área' : 'Reativar Área'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="map">Mapa Geográfico</TabsTrigger>
          <TabsTrigger value="soil">Análises de Solo</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes</CardTitle>
                </CardHeader>
                <CardContent>
                  {canEdit ? (
                    <AreaForm
                      initialData={area}
                      farms={farms}
                      onSubmit={handleUpdate}
                      isSubmitting={isSubmitting}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fazenda</p>
                        <p>{farm?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Área Declarada</p>
                        <p>{area.declared_area_ha ? `${area.declared_area_ha} ha` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Observações</p>
                        <p>{area.notes || '-'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Safras</CardTitle>
                  {canEdit && (
                    <Sheet open={isSeasonSheetOpen} onOpenChange={setIsSeasonSheetOpen}>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="secondary">
                          <Plus className="mr-2 h-4 w-4" /> Nova Safra
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                        <SheetHeader className="mb-6">
                          <SheetTitle>Cadastrar Safra</SheetTitle>
                        </SheetHeader>
                        <SeasonForm
                          onSubmit={handleCreateSeason}
                          isSubmitting={isSubmittingSeason}
                          onCancel={() => setIsSeasonSheetOpen(false)}
                        />
                      </SheetContent>
                    </Sheet>
                  )}
                </CardHeader>
                <CardContent>
                  {seasons.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                      <Calendar className="h-8 w-8 mb-2 opacity-20" />
                      Nenhuma safra cadastrada para esta área.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ano/Safra</TableHead>
                          <TableHead>Identificação</TableHead>
                          <TableHead>Cultura</TableHead>
                          <TableHead>Prod. Esperada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {seasons.map((season) => (
                          <TableRow key={season.id}>
                            <TableCell className="font-medium">{season.season_year}</TableCell>
                            <TableCell>{season.label || '-'}</TableCell>
                            <TableCell>{season.crop || '-'}</TableCell>
                            <TableCell>
                              {season.expected_productivity
                                ? `${season.expected_productivity}`
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-0">
          <AreaMapTab area={area} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="soil" className="mt-0">
          <SoilAnalysisTab area={area} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
