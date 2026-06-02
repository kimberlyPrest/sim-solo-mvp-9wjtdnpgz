import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, User } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tables } from '@/lib/supabase/types'
import { ProducerForm, ProducerFormData } from './ProducerForm'

export default function ProducersPage() {
  const { organization, hasRole } = useAuth()
  const [producers, setProducers] = useState<Tables<'producers'>[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const canEdit = hasRole(['admin', 'technician'])

  const fetchProducers = async () => {
    if (!organization) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('producers')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name')
      if (error) throw error
      if (data) setProducers(data)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducers()
  }, [organization])

  const handleCreate = async (data: ProducerFormData) => {
    if (!organization) return
    setIsSubmitting(true)
    const { error } = await supabase.from('producers').insert([
      {
        ...data,
        organization_id: organization.id,
        status: 'active',
      },
    ])
    setIsSubmitting(false)

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Produtor criado com sucesso.' })
      setIsSheetOpen(false)
      fetchProducers()
    }
  }

  const filtered = producers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.document && p.document.includes(search)),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtores</h1>
          <p className="text-muted-foreground">Gerenciamento de produtores rurais.</p>
        </div>
        {canEdit && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Produtor
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Cadastrar Produtor</SheetTitle>
              </SheetHeader>
              <ProducerForm
                onSubmit={handleCreate}
                isSubmitting={isSubmitting}
                onCancel={() => setIsSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>

      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar produtor..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Nenhum produtor encontrado</h3>
              <p className="text-sm text-muted-foreground">
                Tente ajustar a busca ou cadastre um novo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((producer) => (
                    <TableRow key={producer.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/produtores/${producer.id}`}
                          className="hover:underline text-primary"
                        >
                          {producer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{producer.document || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={producer.status === 'active' ? 'default' : 'secondary'}>
                          {producer.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
