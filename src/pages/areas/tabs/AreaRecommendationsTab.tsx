import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

const setSchema = z.object({
  campaign_id: z.string().min(1, 'Selecione uma campanha'),
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  kind: z.enum(['corrective', 'nutritional', 'organic']),
  title: z.string().optional(),
})

export function AreaRecommendationsTab({ areaId }: { areaId: string }) {
  const [sets, setSets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])

  const form = useForm<z.infer<typeof setSchema>>({
    resolver: zodResolver(setSchema),
    defaultValues: {
      campaign_id: '',
      name: '',
      kind: 'corrective',
      title: '',
    },
  })

  useEffect(() => {
    loadSets()
    loadCampaigns()
  }, [areaId])

  async function loadCampaigns() {
    const { data } = await supabase
      .from('sampling_campaigns')
      .select('id, name, area_seasons!inner(area_id)')
      .eq('area_seasons.area_id', areaId)
    setCampaigns(data || [])
  }

  async function loadSets() {
    setLoading(true)
    const { data } = await supabase
      .from('recommendation_sets')
      .select(`
        *,
        profiles!recommendation_sets_created_by_fkey(full_name),
        sampling_campaigns!inner(name, area_seasons!inner(area_id))
      `)
      .eq('sampling_campaigns.area_seasons.area_id', areaId)
      .order('created_at', { ascending: false })

    setSets(data || [])
    setLoading(false)
  }

  async function onSubmit(values: z.infer<typeof setSchema>) {
    try {
      const { data: orgs } = await supabase
        .from('organization_members')
        .select('organization_id')
        .limit(1)
      const orgId = orgs?.[0]?.organization_id
      if (!orgId) throw new Error('Organização não encontrada')

      const { error } = await supabase.from('recommendation_sets').insert({
        organization_id: orgId,
        campaign_id: values.campaign_id,
        name: values.name,
        title: values.title,
        kind: values.kind,
        created_by: user?.id,
      })

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Recomendação criada com sucesso.' })
      setIsDialogOpen(false)
      form.reset()
      loadSets()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="animate-pulse h-32 bg-muted/20 rounded-xl"></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Conjuntos de Recomendação</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova Recomendação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Recomendação</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="campaign_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campanha</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {campaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Interno</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Correção Safra 23/24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corrective">Corretiva</SelectItem>
                          <SelectItem value="nutritional">Nutricional</SelectItem>
                          <SelectItem value="organic">Orgânica</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sets.length === 0 ? (
          <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed">
            <p className="text-muted-foreground">Nenhuma recomendação registrada para esta área.</p>
          </div>
        ) : (
          sets.map((set) => (
            <Card key={set.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{set.name}</CardTitle>
                    <CardDescription>
                      Campanha: {set.sampling_campaigns?.name} • Tipo:{' '}
                      <span className="capitalize">{set.kind}</span>
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4 mr-2" /> Editar Itens
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
