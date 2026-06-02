import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Archive, Map, Plus } from 'lucide-react'
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
import { FarmForm, FarmFormData } from './FarmForm'
import { Tables } from '@/lib/supabase/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function FarmDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()
  type FarmWithProducer = Tables<'farms'> & { producers: { name: string } | null }
  const [farm, setFarm] = useState<FarmWithProducer | null>(null)
  const [areas, setAreas] = useState<Tables<'areas'>[]>([])
  const [producers, setProducers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)
    try {
      const [farmRes, areasRes, prodRes] = await Promise.all([
        supabase
          .from('farms')
          .select('*, producers(name)')
          .eq('id', id)
          .eq('organization_id', organization.id)
          .single(),
        supabase.from('areas').select('*').eq('farm_id', id).eq('organization_id', organization.id),
        supabase.from('producers').select('id, name').eq('organization_id', organization.id),
      ])
      if (farmRes.error) throw farmRes.error
      if (areasRes.error) throw areasRes.error
      if (prodRes.error) throw prodRes.error
      if (farmRes.data) setFarm(farmRes.data as any)
      if (areasRes.data) setAreas(areasRes.data)
      if (prodRes.data) setProducers(prodRes.data)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id, organization])

  const handleUpdate = async (data: FarmFormData) => {
    setIsSubmitting(true)
    const { error } = await supabase.from('farms').update(data).eq('id', id)
    setIsSubmitting(false)
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Sucesso', description: 'Fazenda atualizada com sucesso.' })
      fetchData()
    }
  }

  const handleArchive = async () => {
    const newStatus = farm.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('farms').update({ status: newStatus }).eq('id', id)
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else {
      toast({
        title: 'Sucesso',
        description: `Fazenda ${newStatus === 'active' ? 'ativada' : 'arquivada'}.`,
      })
      fetchData()
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>
  if (!farm) return <div className="p-8 text-center">Fazenda não encontrada.</div>

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
            <BreadcrumbLink asChild>
              <Link to={`/produtores/${farm.producer_id}`}>{farm.producers?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{farm.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{farm.name}</h1>
          <Badge variant={farm.status === 'active' ? 'default' : 'secondary'}>
            {farm.status === 'active' ? 'Ativo' : 'Arquivado'}
          </Badge>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            {farm.status === 'active' ? 'Arquivar Fazenda' : 'Reativar Fazenda'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <FarmForm
                  initialData={farm}
                  producers={producers}
                  onSubmit={handleUpdate}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Área Total</p>
                    <p>{farm.total_area_ha ? `${farm.total_area_ha} ha` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cidade/UF</p>
                    <p>{farm.city ? `${farm.city} - ${farm.state}` : '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Áreas / Talhões</CardTitle>
              {canEdit && (
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/areas">
                    <Plus className="mr-2 h-4 w-4" /> Nova Área
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {areas.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                  <Map className="h-8 w-8 mb-2 opacity-20" />
                  Nenhuma área cadastrada.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Área</TableHead>
                      <TableHead>Área Declarada (ha)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {areas.map((area) => (
                      <TableRow key={area.id}>
                        <TableCell className="font-medium">
                          <Link to={`/areas/${area.id}`} className="text-primary hover:underline">
                            {area.name}
                          </Link>
                        </TableCell>
                        <TableCell>{area.declared_area_ha || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
