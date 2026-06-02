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
import { Loader2, AlertTriangle, Plus } from 'lucide-react'
import { NewCampaignModal } from '@/features/campaigns/NewCampaignModal'

const formSchema = z.object({
  campaign_id: z.string().min(1, 'Campanha é obrigatória'),
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
  }
}

export function ImportSoilWizard({
  open,
  onOpenChange,
  campaigns,
  onSuccess,
  onCampaignCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaigns: { id: string; name: string }[]
  onSuccess?: () => void
  onCampaignCreated?: (newId: string) => void
}) {
  const [step, setStep] = useState(1)
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [payload, setPayload] = useState<Record<string, any> | null>(null)
  const { organization, session } = useAuth()

  const [localCampaigns, setLocalCampaigns] = useState<{ id: string; name: string }[]>(campaigns)

  useEffect(() => {
    setLocalCampaigns(campaigns)
  }, [campaigns])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { campaign_id: '', laboratory: '', source: 'sim' },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!file) return toast({ title: 'Atenção', description: 'Selecione um arquivo .xlsx' })
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
            campaignId: data.campaign_id,
            organizationId: organization?.id,
          }),
        },
      )

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      setPreviewData(result)
      setPayload({ ...data, storagePath, originalName: file.name, fileSize: file.size })
      setStep(2)
    } catch (err: Error | any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirm = async () => {
    setIsUploading(true)
    try {
      const { error } = await supabase.rpc('commit_soil_analysis_import', {
        p_import_id: crypto.randomUUID(),
        p_org_id: organization?.id,
        p_campaign_id: payload.campaign_id,
        p_file_path: payload.storagePath,
        p_original_name: payload.originalName,
        p_file_size: payload.fileSize,
        p_data: previewData.data,
        p_metadata: {
          laboratory: payload.laboratory,
          sample_date: payload.sample_date || null,
          result_date: payload.result_date || null,
          source: payload.source,
        },
      })
      if (error) throw error
      toast({ title: 'Sucesso', description: 'Importação concluída.' })
      onOpenChange(false)
      window.dispatchEvent(new CustomEvent('refresh-soil-analyses'))
      if (onSuccess) onSuccess()
    } catch (err: Error | any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const hasErrors =
    previewData?.validationSummary?.errors?.length > 0 ||
    previewData?.validationSummary?.unmatchedPoints > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Importar Análises de Solo</SheetTitle>
        </SheetHeader>

        {step === 1 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="campaign_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campanha</FormLabel>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {localCampaigns.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => setIsNewCampaignOpen(true)}
                        title="Nova Campanha"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
                      <Input {...field} />
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
                <FormLabel>Arquivo Excel (.xlsx)</FormLabel>
                <Input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </FormItem>
              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuar
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
                    Colunas Desconhecidas (ignoradas):
                  </span>
                  {previewData.validationSummary.unknownColumns.join(', ')}
                </div>
              </div>
            )}

            {hasErrors ? (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                <span className="font-semibold block mb-2">
                  Foram encontrados erros que impedem a importação:
                </span>
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
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
                Importação
              </Button>
            </div>
          </div>
        )}
      </SheetContent>

      <NewCampaignModal
        open={isNewCampaignOpen}
        onOpenChange={setIsNewCampaignOpen}
        onSuccess={(newCamp) => {
          setLocalCampaigns((prev) => [...prev, newCamp])
          form.setValue('campaign_id', newCamp.id)
          if (onCampaignCreated) onCampaignCreated(newCamp.id)
        }}
      />
    </Sheet>
  )
}
