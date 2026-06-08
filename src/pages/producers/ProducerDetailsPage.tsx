import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, ArrowLeft, Tractor, Plus, Trash2 } from 'lucide-react'
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
import { ProducerForm, ProducerFormData } from './ProducerForm'
import { Tables } from '@/lib/supabase/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeleteEntityDialog } from '@/components/DeleteEntityDialog'
import { deleteProducerCascade } from '@/lib/entity-deletion'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FarmForm, FarmFormData } from '../farms/FarmForm'

export default function ProducerDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()
  const [producer, setProducer] = useState<Tables<'producers'> | null>(null)
  const [farms, setFarms] = useState<Tables<'farms'>[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [farmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isFarmSubmitting, setIsFarmSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization || !id) return
    setLoading(true)
    try {
      const [prodRes, farmsRes] = await Promise.all([
        supabase
          .from('producers')
          .select('*')
          .eq('id', id)
          .eq('organization_id', organization.id)
          .single(),
        supabase
          .from('farms')
          .select('*')
          .eq('producer_id', id)
          .eq('organization_id', organization.id),
      ])
      if (prodRes.error) throw prodRes.error
      if (farmsRes.error) throw farmsRes.error
      if (prodRes.data) setProducer(prodRes.data)
      if (farmsRes.data) setFarms(farmsRes.data)
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

  useEffect(() => {
    if (loading || !producer || !canEdit || searchParams.get('setup') !== 'farm') return
    setFarmSheetOpen(true)
    setSearchParams({}, { replace: true })
  }, [canEdit, loading, producer, searchParams, setSearchParams])

  const handleUpdate = async (data: ProducerFormData) => {
    setIsSubmitting(true)
    const { error } = await supabase.from('producers').update(data).eq('id', id)
    setIsSubmitting(false)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Produtor atualizado com sucesso.' })
      fetchData()
    }
  }

  const handleCreateFarm = async (data: FarmFormData) => {
    if (!organization || !producer) return
    setIsFarmSubmitting(true)
    try {
      const { data: createdFarm, error } = await supabase
        .from('farms')
        .insert([
          {
            ...data,
            producer_id: producer.id,
            organization_id: organization.id,
            status: 'active',
          },
        ])
        .select('id')
        .single()

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Fazenda criada com sucesso.' })
      setFarmSheetOpen(false)
      if (createdFarm?.id) navigate(`/fazendas/${createdFarm.id}?setup=area`)
      else fetchData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsFarmSubmitting(false)
    }
  }

  const handleArchive = async () => {
    const newStatus = producer.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase.from('producers').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: 'Sucesso',
        description: `Produtor ${newStatus === 'active' ? 'ativado' : 'arquivado'}.`,
      })
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!producer) return
    setIsDeleting(true)
    try {
      await deleteProducerCascade(producer.id)
      toast({ title: 'Sucesso', description: 'Produtor apagado definitivamente.' })
      navigate('/produtores')
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>
  if (!producer) return <div className="p-8 text-center">Produtor não encontrado.</div>

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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{producer.name}</h1>
          <Badge variant={producer.status === 'active' ? 'default' : 'secondary'}>
            {producer.status === 'active' ? 'Ativo' : 'Arquivado'}
          </Badge>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {producer.status === 'active' ? 'Arquivar Produtor' : 'Reativar Produtor'}
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar
            </Button>
          </div>
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
                <ProducerForm
                  initialData={producer}
                  onSubmit={handleUpdate}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CPF/CNPJ</p>
                    <p>{producer.document || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                    <p>{producer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                    <p>{producer.phone || '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fazendas Vinculadas</CardTitle>
              {canEdit && (
                <Button size="sm" variant="secondary" onClick={() => setFarmSheetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Fazenda
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {farms.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                  <Tractor className="h-8 w-8 mb-2 opacity-20" />
                  <span>Nenhuma fazenda vinculada a este produtor.</span>
                  {canEdit && (
                    <Button size="sm" className="mt-4" onClick={() => setFarmSheetOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Criar primeira fazenda
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Fazenda</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farms.map((farm) => (
                      <TableRow key={farm.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/fazendas/${farm.id}`}
                            className="text-primary hover:underline"
                          >
                            {farm.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {farm.city ? `${farm.city} - ${farm.state || ''}` : '-'}
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

      <Sheet open={farmSheetOpen} onOpenChange={setFarmSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Nova fazenda para {producer.name}</SheetTitle>
          </SheetHeader>
          <FarmForm
            initialData={{ producer_id: producer.id }}
            producers={[{ id: producer.id, name: producer.name }]}
            onSubmit={handleCreateFarm}
            isSubmitting={isFarmSubmitting}
            onCancel={() => setFarmSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteEntityDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar produtor"
        description={`Você está prestes a apagar ${producer.name}.`}
        details="Também serão apagadas as fazendas, áreas, safras, pontos, análises e recomendações vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
