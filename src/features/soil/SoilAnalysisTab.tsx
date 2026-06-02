import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { ImportSoilWizard } from './ImportSoilWizard'
import { SoilAnalysisList } from './SoilAnalysisList'
import { toast } from '@/hooks/use-toast'

export function SoilAnalysisTab({ area, canEdit }: any) {
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const { session } = useAuth()

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('sampling_campaigns')
        .select('id, name, area_seasons!inner(area_id)')
        .eq('area_seasons.area_id', area.id)
      if (data) setCampaigns(data)
    }
    fetchCampaigns()
  }, [area.id])

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soil-analysis-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'generate_template' }),
        },
      )

      if (!res.ok) throw new Error('Erro ao gerar template')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template_analise_solo.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Análises de Solo</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Template Excel
            </Button>
            <Button onClick={() => setIsImportWizardOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Importar Análises
            </Button>
          </div>
        )}
      </div>

      <SoilAnalysisList areaId={area.id} campaigns={campaigns} />

      {isImportWizardOpen && (
        <ImportSoilWizard
          open={isImportWizardOpen}
          onOpenChange={setIsImportWizardOpen}
          campaigns={campaigns}
        />
      )}
    </div>
  )
}
