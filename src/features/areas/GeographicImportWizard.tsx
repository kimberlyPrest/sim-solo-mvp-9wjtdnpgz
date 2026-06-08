import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { GeoMap } from '@/components/map/GeoMap'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'

type PreviewData = {
  boundary: any
  points: { code: string; lng: number; lat: number }[]
  calculatedAreaHa: number
  divergencePct: number
  validationSummary: {
    boundaryValid: boolean
    pointsInside: number
    pointsOutside: number
    outsideCodes: string[]
  }
}

async function reverseGeocode(boundary: any): Promise<{ city?: string; state?: string } | null> {
  try {
    const geom = boundary?.geometry || boundary
    const ring = geom?.coordinates?.[0]
    if (!ring?.length) return null
    const lngSum = ring.reduce((s: number, c: number[]) => s + c[0], 0)
    const latSum = ring.reduce((s: number, c: number[]) => s + c[1], 0)
    const lng = lngSum / ring.length
    const lat = latSum / ring.length
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    )
    const geo = await res.json()
    const city =
      geo.address?.municipality || geo.address?.city || geo.address?.town || geo.address?.village
    const state = geo.address?.state
    return { city, state }
  } catch {
    return null
  }
}

export function GeographicImportWizard({
  open,
  onOpenChange,
  area,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  area: { id: string; farm_id?: string }
  onSuccess: () => void
}) {
  const { organization } = useAuth()
  const { toast } = useToast()
  const [orgId, setOrgId] = useState<string | null>(organization?.id || null)

  const [step, setStep] = useState<1 | 2>(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [action, setAction] = useState<'initial' | 'add_points' | 'update_boundary'>('initial')
  const [projection, setProjection] = useState<string>('EPSG:4326')
  const [justification, setJustification] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [filePath, setFilePath] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (organization?.id) {
      setOrgId(organization.id)
    } else {
      supabase
        .from('areas')
        .select('organization_id')
        .eq('id', area.id)
        .single()
        .then(({ data }) => {
          if (data) setOrgId(data.organization_id)
        })
    }
  }, [open, area.id, organization?.id])

  const resetState = () => {
    setStep(1)
    setAction('initial')
    setProjection('EPSG:4326')
    setJustification('')
    setFile(null)
    setPreviewData(null)
    setFilePath('')
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) resetState()
    onOpenChange(o)
  }

  const handleProcessFile = async () => {
    if (!file) {
      return toast({
        title: 'Erro',
        description: 'Selecione um arquivo ZIP.',
        variant: 'destructive',
      })
    }
    if (action === 'update_boundary' && !justification) {
      return toast({
        title: 'Erro',
        description: 'Justificativa obrigatória.',
        variant: 'destructive',
      })
    }

    setIsProcessing(true)
    try {
      if (!orgId) throw new Error('Organização não identificada.')
      const ext = file.name.split('.').pop()
      const newFilePath = `${orgId}/${crypto.randomUUID()}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('soil-imports')
        .upload(newFilePath, file, { upsert: true })

      if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`)

      const actualPath = uploadData?.path || newFilePath

      const { data, error: fnError } = await supabase.functions.invoke('parse-shapefile', {
        body: { storagePath: actualPath, action, projection },
      })

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Falha ao processar arquivo')
      }

      setPreviewData(data)
      setFilePath(actualPath)
      setStep(2)
    } catch (err: any) {
      toast({ title: 'Erro no processamento', description: err.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      const { error } = await supabase.rpc('commit_geographic_import', {
        p_import_id: crypto.randomUUID(),
        p_area_id: area.id,
        p_campaign_id: null,
        p_action: action,
        p_boundary_geojson: previewData!.boundary,
        p_points: previewData!.points,
        p_calculated_area_ha: previewData!.calculatedAreaHa,
        p_source_srid: projection === 'EPSG:4326' ? 4326 : 32723,
        p_justification: justification,
        p_org_id: orgId as string,
        p_file_path: filePath,
        p_original_name: file?.name,
        p_file_size: file?.size,
      })

      if (error) throw error

      // Best-effort: update farm city/state from boundary centroid
      const farmId = area.farm_id
      if (farmId && (action === 'initial' || action === 'update_boundary')) {
        reverseGeocode(previewData!.boundary).then((geo) => {
          if (geo?.city || geo?.state) {
            supabase
              .from('farms')
              .update({
                ...(geo.city && { city: geo.city }),
                ...(geo.state && { state: geo.state }),
              })
              .eq('id', farmId)
              .then(() => {})
          }
        })
      }

      toast({ title: 'Sucesso', description: 'Importação concluída com sucesso.' })
      onSuccess()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Dados Geográficos</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Configure e faça o upload do Shapefile (ZIP).'
              : 'Revise os dados antes de confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="space-y-3">
              <Label>Ação</Label>
              <RadioGroup
                value={action}
                onValueChange={(v) => setAction(v as typeof action)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {(
                  [
                    { value: 'initial', label: 'Configuração Inicial' },
                    { value: 'add_points', label: 'Adicionar Pontos' },
                    { value: 'update_boundary', label: 'Atualizar Contorno' },
                  ] as const
                ).map(({ value, label }) => (
                  <div
                    key={value}
                    className={`flex items-center space-x-2 border p-3 rounded-md transition-colors ${
                      action === value ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem value={value} id={value} />
                    <Label htmlFor={value} className="cursor-pointer font-medium w-full">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Projeção</Label>
                <Select value={projection} onValueChange={setProjection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EPSG:4326">WGS84 (Graus Decimais) — EPSG:4326</SelectItem>
                    <SelectItem value="EPSG:32723">UTM Zona 23S (Metros) — EPSG:32723</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arquivo ZIP (Shapefile)</Label>
                <Input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  O ZIP deve conter .shp, .shx e .dbf correspondentes.
                </p>
              </div>

              {action === 'update_boundary' && (
                <div className="space-y-2">
                  <Label>Justificativa para Alteração</Label>
                  <Textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Motivo para alterar o contorno da área..."
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcessFile} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Processar Arquivo
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && previewData && (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">Resumo da Área</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Área Calculada:</span>
                    <span className="font-medium">
                      {previewData.calculatedAreaHa.toFixed(2)} ha
                    </span>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">Resumo dos Pontos</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total de Pontos:</span>
                    <span className="font-medium">{previewData.points.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pontos Internos:</span>
                    <span className="font-medium text-green-600">
                      {previewData.validationSummary.pointsInside}
                    </span>
                  </div>
                  {previewData.validationSummary.pointsOutside > 0 && (
                    <div className="flex justify-between">
                      <span>Pontos Externos:</span>
                      <span className="font-medium text-destructive">
                        {previewData.validationSummary.pointsOutside}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {previewData.validationSummary.pointsOutside > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Pontos fora do contorno</AlertTitle>
                <AlertDescription>
                  {previewData.validationSummary.outsideCodes.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div
              className="relative rounded-md overflow-hidden border border-border/40"
              style={{ height: 350, isolation: 'isolate' }}
            >
              <GeoMap boundary={previewData.boundary} points={previewData.points} height="100%" />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Importação
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
