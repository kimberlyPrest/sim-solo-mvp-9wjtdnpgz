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

type Season = { id: string; season_year: string; crop: string | null }

const setSchema = z.object({
  season_id: z.string().min(1, 'Selecione uma safra'),
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  kind: z.enum(['corrective', 'nutritional', 'organic']),
  title: z.string().optional(),
})

export function AreaRecommendationsTab({ areaId, canEdit }: { areaId: string; canEdit: boolean }) {
  const [sets, setSets] = useState<any[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const { user, organization } = useAuth()
  const { toast } = useToast()

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const form = useForm<z.infer<typeof setSchema>>({
    resolver: zodResolver(setSchema),
    defaultValues: { season_id: '', name: '', kind: 'corrective', title: '' },
  })

  useEffect(() => {
    loadSeasons()
    loadSets()
  }, [areaId])

  async function loadSeasons() {
    const { data } = await supabase
      .from('area_seasons')
      .select('id, season_year, crop')
      .eq('area_id', areaId)
      .order('season_year', { ascending: false })
    setSeasons(data || [])
  }

  async function loadSets() {
    setLoading(true)
    setHasError(false)

    // Step 1: get campaign IDs for this area (1-level join filter — works in PostgREST)
    const { data: campData } = await supabase
      .from('sampling_campaigns')
      .select('id, area_season_id, area_seasons!inner(area_id)')
      .eq('area_seasons.area_id', areaId)

    const campaignIds = campData?.map((c) => c.id) || []

    if (!campaignIds.length) {
      setSets([])
      setLoading(false)
      return
    }

    // Step 2: recommendation_sets for those campaigns (.in filter — no deep join needed)
    const { data, error } = await supabase
      .from('recommendation_sets')
      .select(
        '*, profiles!recommendation_sets_created_by_fkey(full_name), sampling_campaigns(area_season_id)',
      )
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false })

    if (error) {
      setHasError(true)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as recomendações.',
        variant: 'destructive',
      })
    }
    setSets(data || [])
    setLoading(false)
  }

  async function findOrCreateCampaign(seasonId: string): Promise<string> {
    const { data: existing } = await supabase
      .from('sampling_campaigns')
      .select('id')
      .eq('area_season_id', seasonId)
      .limit(1)
      .maybeSingle()

    if (existing) return existing.id

    const { data: season } = await supabase
      .from('area_seasons')
      .select('season_year')
      .eq('id', seasonId)
      .single()

    const { data: created, error } = await supabase
      .from('sampling_campaigns')
      .insert({
        organization_id: organization?.id,
        area_season_id: seasonId,
        name: `Amostragem ${season?.season_year || ''}`.trim(),
        source: 'sim' as const,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return created.id
  }

  async function onSubmit(values: z.infer<typeof setSchema>) {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada')
      const campaignId = await findOrCreateCampaign(values.season_id)
      const { error } = await supabase.from('recommendation_sets').insert({
        organization_id: organization.id,
        campaign_id: campaignId,
        name: values.name,
        title: values.title || null,
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

  function seasonLabel(set: any) {
    const seasonId = set.sampling_campaigns?.area_season_id
    const s = seasons.find((x) => x.id === seasonId)
    if (!s) return null
    return s.crop ? `${s.season_year} (${s.crop})` : s.season_year
  }

  if (loading) return <div className="animate-pulse h-32 bg-muted/20 rounded-xl" />

  if (hasError) {
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar recomendações. Tente recarregar a página.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Conjuntos de Recomendação</h2>
        {canEdit && (
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
                    name="season_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Safra</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma safra..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {seasons.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.crop ? `${s.season_year} (${s.crop})` : s.season_year}
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
        )}
      </div>

      <div className="grid gap-4">
        {sets.length === 0 ? (
          <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed">
            <p className="text-muted-foreground">Nenhuma recomendação registrada para esta área.</p>
          </div>
        ) : (
          sets.map((set) => {
            const label = seasonLabel(set)
            return (
              <Card key={set.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{set.name}</CardTitle>
                      <CardDescription>
                        {label && <>{label} · </>}
                        Tipo: <span className="capitalize">{set.kind}</span>
                      </CardDescription>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4 mr-2" /> Editar Itens
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
