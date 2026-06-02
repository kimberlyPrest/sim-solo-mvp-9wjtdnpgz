import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function NewCampaignModal({
  open,
  onOpenChange,
  onSuccess,
  prefilledAreaId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (campaign: { id: string; name: string }) => void
  prefilledAreaId?: string
}) {
  const { organization } = useAuth()
  const { toast } = useToast()

  const [areas, setAreas] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [areaId, setAreaId] = useState(prefilledAreaId || '')
  const [seasonId, setSeasonId] = useState('')
  const [newSeasonYear, setNewSeasonYear] = useState('')
  const [newSeasonCrop, setNewSeasonCrop] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [sampleDate, setSampleDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !organization) return
    async function loadAreas() {
      setLoading(true)
      const { data } = await supabase
        .from('areas')
        .select(`id, name, farms!inner(name)`)
        .eq('organization_id', organization.id)
        .order('name')
      if (data) setAreas(data)
      setLoading(false)
    }
    loadAreas()
  }, [open, organization])

  useEffect(() => {
    if (!areaId) {
      setSeasons([])
      setSeasonId('')
      return
    }
    async function loadSeasons() {
      const { data } = await supabase
        .from('area_seasons')
        .select('id, season_year, crop')
        .eq('area_id', areaId)
        .order('season_year', { ascending: false })
      if (data) setSeasons(data)
    }
    loadSeasons()
  }, [areaId])

  useEffect(() => {
    if (prefilledAreaId && !areaId) {
      setAreaId(prefilledAreaId)
    }
  }, [prefilledAreaId])

  const handleSave = async () => {
    if (!name || !areaId || !seasonId) {
      toast({
        title: 'Atenção',
        description: 'Preencha os campos obrigatórios',
        variant: 'destructive',
      })
      return
    }

    if (seasonId === 'new_season' && !newSeasonYear) {
      toast({
        title: 'Atenção',
        description: 'O ano da safra é obrigatório para nova safra.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      let finalSeasonId = seasonId

      if (seasonId === 'new_season') {
        const { data: newSeason, error: seasonError } = await supabase
          .from('area_seasons')
          .insert({
            organization_id: organization?.id,
            area_id: areaId,
            season_year: newSeasonYear,
            crop: newSeasonCrop || null,
          })
          .select('id')
          .single()

        if (seasonError) {
          if (seasonError.code === '23505') {
            throw new Error('Já existe uma safra com este ano para a área selecionada.')
          }
          throw seasonError
        }
        finalSeasonId = newSeason.id
      }

      const { data: existing } = await supabase
        .from('sampling_campaigns')
        .select('id')
        .eq('area_season_id', finalSeasonId)
        .eq('name', name)
        .maybeSingle()

      if (existing) {
        throw new Error('Já existe uma campanha com este nome nesta safra/área.')
      }

      const { data, error } = await supabase
        .from('sampling_campaigns')
        .insert({
          organization_id: organization?.id,
          area_season_id: finalSeasonId,
          name,
          start_date: startDate || null,
          end_date: endDate || null,
          laboratory: laboratory || null,
          sample_date: sampleDate || null,
          notes: notes || null,
          source: 'sim',
        })
        .select('id, name')
        .single()

      if (error) throw error

      toast({ title: 'Sucesso', description: 'Campanha criada com sucesso!' })
      onSuccess({ id: data.id, name: data.name })
      onOpenChange(false)

      setName('')
      if (!prefilledAreaId) setAreaId('')
      setSeasonId('')
      setNewSeasonYear('')
      setNewSeasonCrop('')
      setStartDate('')
      setEndDate('')
      setLaboratory('')
      setSampleDate('')
      setNotes('')
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
          <DialogDescription>
            Crie uma nova campanha de amostragem de solo para uma safra e área específicas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Área <span className="text-destructive">*</span>
              </Label>
              <Select
                value={areaId}
                onValueChange={setAreaId}
                disabled={!!prefilledAreaId || loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área..." />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.farms?.name} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Safra <span className="text-destructive">*</span>
              </Label>
              <Select value={seasonId} onValueChange={setSeasonId} disabled={!areaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a safra..." />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.season_year} {s.crop ? `(${s.crop})` : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="new_season" className="font-semibold text-primary">
                    + Criar Nova Safra
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {seasonId === 'new_season' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/30">
              <div className="space-y-2">
                <Label>
                  Ano da Safra <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newSeasonYear}
                  onChange={(e) => setNewSeasonYear(e.target.value)}
                  placeholder="Ex: 2024/2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Cultura</Label>
                <Input
                  value={newSeasonCrop}
                  onChange={(e) => setNewSeasonCrop(e.target.value)}
                  placeholder="Ex: Soja"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Nome da Campanha <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Amostragem Grade 2ha"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Laboratório</Label>
              <Input
                value={laboratory}
                onChange={(e) => setLaboratory(e.target.value)}
                placeholder="Ex: IBRA"
              />
            </div>
            <div className="space-y-2">
              <Label>Data da Coleta (Lab)</Label>
              <Input
                type="date"
                value={sampleDate}
                onChange={(e) => setSampleDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Campanha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
