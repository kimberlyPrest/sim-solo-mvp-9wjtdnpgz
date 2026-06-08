import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Loader2, AlertTriangle, Download } from 'lucide-react'

const formSchema = z.object({
  season_id: z.string().min(1, 'Safra é obrigatória'),
  laboratory: z.string().min(1, 'Laboratório é obrigatório'),
  sample_date: z.string().optional(),
  result_date: z.string().optional(),
  source: z.enum(['sim', 'historical_standardized']),
})

type PreviewData = {
  data: any[]
  validationSummary: {
    totalRows: number
    matchedPoints: number
    unmatchedPoints: number
    errors: string[]
    unknownColumns: string[]
    detectedRecommendationSheets: string[]
  }
}

type Season = { id: string; season_year: string; crop: string | null }

export function ImportSoilWizard({
  open,
  onOpenChange,
  areaId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  areaId: string
  onSuccess?: (seasonId?: string) => void
}) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [payload, setPayload] = useState<Record<string, any> | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const { organization, session } = useAuth()

  useEffect(() => {
    if (!open || !areaId) return
    supabase
      .from('area_seasons')
      .select('id, season_year, crop')
      .eq('area_id', areaId)
      .order('season_year', { ascending: false })
      .then(({ data }) => {
        if (data) setSeasons(data)
      })
  }, [open, areaId])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { season_id: '', laboratory: '', source: 'sim' },
  })

  const seasonLabel = (s: Season) => (s.crop ? `${s.season_year} (${s.crop})` : s.season_year)

  const downloadTemplate = async () => {
    setIsDownloadingTemplate(true)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soil-analysis-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'generate_template',
            areaId,
            organizationId: organization?.id,
          }),
        },
      )
      if (!res.ok) throw new Error('Falha ao gerar template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template_analise_solo.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!file)
      return toast({ title: 'Atenção', description: 'Selecione um arquivo .xlsx ou .xlsm' })
    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const storagePath = `${organization?.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('soil-imports')
        .upload(storagePath, file)
      if (uploadError) throw uploadError

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soil-analysis-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'parse',
            storagePath,
            areaId,
            organizationId: organization?.id,
          }),
        },
      )

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      setPreviewData(result)
      setPayload({
        ...data,
        areaSeasonId: data.season_id,
        storagePath,
        originalName: file.name,
        fileSize: file.size,
      })
      setStep(2)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirm = async () => {
    setIsUploading(true)
    try {
      const { error } = await (supabase.rpc as any)('commit_soil_analysis_import', {
        p_import_id: crypto.randomUUID(),
        p_org_id: organization?.id,
        p_area_season_id: payload!.areaSeasonId,
        p_file_path: payload!.storagePath,
        p_original_name: payload!.originalName,
        p_file_size: payload!.fileSize,
        p_data: previewData!.data,
        p_metadata: {
          laboratory: payload!.laboratory,
          sample_date: payload!.sample_date || null,
          result_date: payload!.result_date || null,
          source: payload!.source,
        },
      })
      if (error) throw error
      toast({ title: 'Sucesso', description: 'Importação concluída.' })
      onOpenChange(false)
      window.dispatchEvent(new CustomEvent('refresh-soil-analyses'))
      if (onSuccess) onSuccess(payload!.areaSeasonId)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const hasErrors =
    (previewData?.validationSummary?.errors?.length ?? 0) > 0 ||
    (previewData?.validationSummary?.unmatchedPoints ?? 0) > 0

  const handleClose = (o: boolean) => {
    if (!o) {
      setStep(1)
      setFile(null)
      setPreviewData(null)
      setPayload(null)
      form.reset()
    }
    onOpenChange(o)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Importar Análises de Solo</SheetTitle>
        </SheetHeader>

        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            disabled={isDownloadingTemplate}
            className="w-full"
          >
            {isDownloadingTemplate ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar Template Excel
          </Button>
        </div>

        {step === 1 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="season_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Safra</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a safra..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {seasons.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Nenhuma safra cadastrada
                          </div>
                        ) : (
                          seasons.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {seasonLabel(s)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laboratory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laboratório</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: IBRA" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sample_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Coleta</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="result_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Resultado</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonte</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sim">SIM</SelectItem>
                        <SelectItem value="historical_standardized">Histórico</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Arquivo Excel (.xlsx, .xlsm)</FormLabel>
                <Input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </FormItem>
              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continuar
              </Button>
            </form>
          </Form>
        )}

        {step === 2 && previewData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-muted p-3 rounded-md">
                Total de Linhas:{' '}
                <span className="font-bold">{previewData.validationSummary.totalRows}</span>
              </div>
              <div className="bg-muted p-3 rounded-md">
                Pontos Válidos:{' '}
                <span className="font-bold">{previewData.validationSummary.matchedPoints}</span>
              </div>
            </div>

            {previewData.validationSummary.unknownColumns.length > 0 && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold block mb-1">
                    Colunas desconhecidas (ignoradas):
                  </span>
                  {previewData.validationSummary.unknownColumns.join(', ')}
                </div>
              </div>
            )}

            {(previewData.validationSummary.detectedRecommendationSheets ?? []).length > 0 && (
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                <span className="font-semibold block mb-1">Abas detectadas (não importadas):</span>
                <p>
                  Seu arquivo contém{' '}
                  <strong>
                    {previewData.validationSummary.detectedRecommendationSheets.join(', ')}
                  </strong>
                  . Essas abas serão importáveis na aba Recomendações.
                </p>
              </div>
            )}

            {hasErrors ? (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                <span className="font-semibold block mb-2">Erros que impedem a importação:</span>
                <ul className="list-disc pl-4 space-y-1">
                  {previewData.validationSummary.errors.map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                Nenhum erro bloqueante encontrado.
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={isUploading}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={hasErrors || isUploading}
              >
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Importação
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
