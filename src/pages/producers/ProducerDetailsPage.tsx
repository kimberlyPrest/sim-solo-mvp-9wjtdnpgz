import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Archive, ArrowLeft, Tractor, Plus } from 'lucide-react'
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

export default function ProducerDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { organization, hasRole } = useAuth()
  const { toast } = useToast()
  const [producer, setProducer] = useState<Tables<'producers'> | null>(null)
  const [farms, setFarms] = useState<Tables<'farms'>[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
          <Button variant="outline" onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            {producer.status === 'active' ? 'Arquivar Produtor' : 'Reativar Produtor'}
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
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/fazendas">
                    <Plus className="mr-2 h-4 w-4" /> Nova Fazenda
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {farms.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                  <Tractor className="h-8 w-8 mb-2 opacity-20" />
                  Nenhuma fazenda vinculada a este produtor.
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
    </div>
  )
}
