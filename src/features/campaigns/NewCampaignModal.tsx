import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  onSuccess: (campaignId: string) => void
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
  const [name, setName] = useState('')
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
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('sampling_campaigns')
        .select('id')
        .eq('area_season_id', seasonId)
        .eq('name', name)
        .single()

      if (existing) {
        throw new Error('Já existe uma campanha com este nome nesta safra/área.')
      }

      const { data, error } = await supabase
        .from('sampling_campaigns')
        .insert({
          organization_id: organization?.id,
          area_season_id: seasonId,
          name,
          laboratory: laboratory || null,
          sample_date: sampleDate || null,
          notes: notes || null,
        })
        .select('id')
        .single()

      if (error) throw error

      toast({ title: 'Sucesso', description: 'Campanha criada com sucesso!' })
      onSuccess(data.id)
      onOpenChange(false)

      setName('')
      if (!prefilledAreaId) setAreaId('')
      setSeasonId('')
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
              </SelectContent>
            </Select>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Laboratório</Label>
              <Input
                value={laboratory}
                onChange={(e) => setLaboratory(e.target.value)}
                placeholder="Ex: IBRA"
              />
            </div>
            <div className="space-y-2">
              <Label>Data da Coleta</Label>
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
