import { useState } from 'react'
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

export function GeographicImportWizard({
  open,
  onOpenChange,
  area,
  campaigns,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  area: { id: string; declared_area_ha: number | null }
  campaigns: { id: string; name: string }[]
  onSuccess: () => void
}) {
  const { organization } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState<1 | 2>(1)
  const [isProcessing, setIsProcessing] = useState(false)

  const [action, setAction] = useState<string>('initial')
  const [campaignId, setCampaignId] = useState<string>('')
  const [sourceCampaignId, setSourceCampaignId] = useState<string>('')
  const [projection, setProjection] = useState<string>('EPSG:4326')
  const [justification, setJustification] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)

  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [importId, setImportId] = useState<string>('')
  const [filePath, setFilePath] = useState<string>('')

  const resetState = () => {
    setStep(1)
    setAction('initial')
    setCampaignId('')
    setSourceCampaignId('')
    setProjection('EPSG:4326')
    setJustification('')
    setFile(null)
    setPreviewData(null)
    setImportId('')
    setFilePath('')
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) resetState()
    onOpenChange(o)
  }

  const handleProcessFile = async () => {
    if (action === 'reuse_points') {
      if (!sourceCampaignId || !campaignId) {
        return toast({
          title: 'Erro',
          description: 'Selecione as campanhas origem e destino.',
          variant: 'destructive',
        })
      }
      return executeReusePoints()
    }

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
    if (['initial', 'new_points'].includes(action) && !campaignId) {
      return toast({
        title: 'Erro',
        description: 'Selecione uma campanha.',
        variant: 'destructive',
      })
    }

    setIsProcessing(true)
    try {
      const ext = file.name.split('.').pop()
      const newImportId = crypto.randomUUID()
      const newFilePath = `${organization?.id}/${newImportId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('soil-imports')
        .upload(newFilePath, file)

      if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`)

      const { data, error: fnError } = await supabase.functions.invoke('parse-shapefile', {
        body: {
          storagePath: newFilePath,
          action,
          declaredAreaHa: area.declared_area_ha,
          projection,
        },
      })

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Falha ao processar arquivo')
      }

      setPreviewData(data)
      setImportId(newImportId)
      setFilePath(newFilePath)
      setStep(2)
    } catch (err: Error | any) {
      toast({ title: 'Erro no processamento', description: err.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const executeReusePoints = async () => {
    setIsProcessing(true)
    try {
      const { error } = await supabase.rpc('reuse_campaign_points', {
        p_source_campaign_id: sourceCampaignId,
        p_target_campaign_id: campaignId,
        p_org_id: organization?.id,
      })
      if (error) throw error
      toast({ title: 'Sucesso', description: 'Pontos reutilizados com sucesso.' })
      onSuccess()
    } catch (err: Error | any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      const { error } = await supabase.rpc('commit_geographic_import', {
        p_import_id: importId,
        p_area_id: area.id,
        p_campaign_id: campaignId || null,
        p_action: action,
        p_boundary_geojson: previewData.boundary,
        p_points: previewData.points,
        p_calculated_area_ha: previewData.calculatedAreaHa,
        p_source_srid: projection === 'EPSG:4326' ? 4326 : 32723,
        p_justification: justification,
        p_org_id: organization?.id,
        p_file_path: filePath,
        p_original_name: file?.name,
        p_file_size: file?.size,
      })

      if (error) throw error
      toast({ title: 'Sucesso', description: 'Importação concluída com sucesso.' })
      onSuccess()
    } catch (err: Error | any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assistente de Importação Geográfica</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Configure e faça o upload dos dados espaciais (Shapefile em ZIP).'
              : 'Revise os dados antes de confirmar a importação.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="space-y-3">
              <Label>Ação</Label>
              <RadioGroup
                value={action}
                onValueChange={setAction}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-center space-x-2 border p-3 rounded-md transition-colors ${action === 'initial' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="initial" id="initial" />
                  <Label htmlFor="initial" className="cursor-pointer font-medium w-full">
                    Configuração Inicial
                  </Label>
                </div>
                <div
                  className={`flex items-center space-x-2 border p-3 rounded-md transition-colors ${action === 'new_points' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="new_points" id="new_points" />
                  <Label htmlFor="new_points" className="cursor-pointer font-medium w-full">
                    Novos Pontos
                  </Label>
                </div>
                <div
                  className={`flex items-center space-x-2 border p-3 rounded-md transition-colors ${action === 'update_boundary' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="update_boundary" id="update_boundary" />
                  <Label htmlFor="update_boundary" className="cursor-pointer font-medium w-full">
                    Atualizar Contorno
                  </Label>
                </div>
                <div
                  className={`flex items-center space-x-2 border p-3 rounded-md transition-colors ${action === 'reuse_points' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="reuse_points" id="reuse_points" />
                  <Label htmlFor="reuse_points" className="cursor-pointer font-medium w-full">
                    Reutilizar Pontos
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {action === 'reuse_points' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campanha Origem</Label>
                  <Select value={sourceCampaignId} onValueChange={setSourceCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Campanha Destino</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {action !== 'update_boundary' && (
                  <div className="space-y-2">
                    <Label>Campanha</Label>
                    <Select value={campaignId} onValueChange={setCampaignId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Projeção</Label>
                  <Select value={projection} onValueChange={setProjection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EPSG:4326">WGS84 (Graus Decimais) - EPSG:4326</SelectItem>
                      <SelectItem value="EPSG:32723">UTM Zona 23S (Metros) - EPSG:32723</SelectItem>
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
                    O ZIP deve conter arquivos .shp, .shx, .dbf correspondentes e apenas 1 camada de
                    cada tipo.
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
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcessFile} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {action === 'reuse_points' ? 'Reutilizar Pontos' : 'Processar Arquivo'}
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
                    <span>Área Declarada:</span>{' '}
                    <span className="font-medium">{area.declared_area_ha || '-'} ha</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Área Calculada:</span>{' '}
                    <span className="font-medium">
                      {previewData.calculatedAreaHa.toFixed(2)} ha
                    </span>
                  </div>
                  {area.declared_area_ha && (
                    <div className="flex justify-between">
                      <span>Divergência:</span>
                      <span
                        className={`font-medium ${previewData.divergencePct > 5 ? 'text-destructive' : 'text-green-600'}`}
                      >
                        {previewData.divergencePct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </Card>
              <Card className="p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">Resumo dos Pontos</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total de Pontos:</span>{' '}
                    <span className="font-medium">{previewData.points.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pontos Internos:</span>{' '}
                    <span className="font-medium text-green-600">
                      {previewData.validationSummary.pointsInside}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pontos Externos:</span>{' '}
                    <span
                      className={`font-medium ${previewData.validationSummary.pointsOutside > 0 ? 'text-destructive' : ''}`}
                    >
                      {previewData.validationSummary.pointsOutside}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {previewData.validationSummary.pointsOutside > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção: Pontos fora do contorno!</AlertTitle>
                <AlertDescription>
                  Os seguintes pontos estão fora da área:{' '}
                  {previewData.validationSummary.outsideCodes.join(', ')}.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-md p-1 bg-muted/10 shadow-sm">
              <GeoMap boundary={previewData.boundary} points={previewData.points} height="350px" />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing}>
                Voltar e Reconfigurar
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
