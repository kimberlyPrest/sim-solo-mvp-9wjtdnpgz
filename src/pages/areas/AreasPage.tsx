import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Map, Trash2 } from 'lucide-react'
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
import { AreaForm, AreaFormData } from './AreaForm'
import { DeleteEntityDialog } from '@/components/DeleteEntityDialog'
import { deleteAreaCascade } from '@/lib/entity-deletion'

export default function AreasPage() {
  const { organization, hasRole } = useAuth()
  type AreaWithFarm = Tables<'areas'> & {
    farms: { name: string; producers: { name: string } | null } | null
  }
  const [areas, setAreas] = useState<AreaWithFarm[]>([])
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AreaWithFarm | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const canEdit = hasRole(['admin', 'technician'])

  const fetchData = async () => {
    if (!organization) return
    setLoading(true)
    try {
      const [areasRes, farmsRes] = await Promise.all([
        supabase
          .from('areas')
          .select('*, farms(name, producers(name))')
          .eq('organization_id', organization.id)
          .order('name'),
        supabase
          .from('farms')
          .select('id, name')
          .eq('organization_id', organization.id)
          .eq('status', 'active'),
      ])
      if (areasRes.error) throw areasRes.error
      if (farmsRes.error) throw farmsRes.error
      if (areasRes.data) setAreas(areasRes.data as any)
      if (farmsRes.data) setFarms(farmsRes.data)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as áreas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [organization])

  const handleCreate = async (data: AreaFormData) => {
    if (!organization) return
    setIsSubmitting(true)
    const { error } = await supabase.from('areas').insert([
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
      toast({ title: 'Sucesso', description: 'Área criada com sucesso.' })
      setIsSheetOpen(false)
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteAreaCascade(deleteTarget.id)
      toast({ title: 'Sucesso', description: 'Área apagada definitivamente.' })
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = areas.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.farms?.name && a.farms.name.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Áreas / Talhões</h1>
          <p className="text-muted-foreground">Controle de áreas de cultivo.</p>
        </div>
        {canEdit && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Área
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Cadastrar Área</SheetTitle>
              </SheetHeader>
              <AreaForm
                farms={farms}
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
              placeholder="Buscar área..."
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
              <Map className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Nenhuma área encontrada</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Área</TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Produtor</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[72px] text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="font-medium">
                        <Link to={`/areas/${area.id}`} className="hover:underline text-primary">
                          {area.name}
                        </Link>
                      </TableCell>
                      <TableCell>{area.farms?.name || '-'}</TableCell>
                      <TableCell>{area.farms?.producers?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={area.status === 'active' ? 'default' : 'secondary'}>
                          {area.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Apagar área ${area.name}`}
                            onClick={() => setDeleteTarget(area)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteEntityDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Apagar área"
        description={
          deleteTarget
            ? `Você está prestes a apagar ${deleteTarget.name}.`
            : 'Você está prestes a apagar esta área.'
        }
        details="Também serão apagadas as safras, pontos, análises e recomendações vinculadas."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
