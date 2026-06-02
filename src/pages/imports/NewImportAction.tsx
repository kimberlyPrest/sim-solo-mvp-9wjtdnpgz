import { useState, useEffect } from 'react'
import { Map, FileSpreadsheet, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { GeographicImportWizard } from '@/features/areas/GeographicImportWizard'
import { ImportSoilWizard } from '@/features/soil/ImportSoilWizard'

export function NewImportAction({ onImportSuccess }: { onImportSuccess: () => void }) {
  const { organization, user } = useAuth()
  const [role, setRole] = useState<string>('viewer')
  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])

  const [isAreaSelectOpen, setIsAreaSelectOpen] = useState(false)
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [isGeoWizardOpen, setIsGeoWizardOpen] = useState(false)
  const [isSoilWizardOpen, setIsSoilWizardOpen] = useState(false)

  useEffect(() => {
    if (!organization || !user) return
    async function loadData() {
      try {
        const { data: member } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organization.id)
          .eq('user_id', user.id)
          .single()

        setRole(member?.role || 'viewer')

        if (member?.role === 'admin' || member?.role === 'technician') {
          const [areasRes, campaignsRes] = await Promise.all([
            supabase
              .from('areas')
              .select(`id, name, declared_area_ha, farms!inner(name)`)
              .eq('organization_id', organization.id)
              .order('name'),
            supabase
              .from('sampling_campaigns')
              .select(`id, name, area_seasons!inner(area_id, areas!inner(name, farms!inner(name)))`)
              .eq('organization_id', organization.id)
              .order('name'),
          ])

          if (areasRes.data) setAreas(areasRes.data)
          if (campaignsRes.data) setCampaigns(campaignsRes.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [organization, user])

  if (loading || role === 'viewer') return null

  const handleGeoSelect = () => {
    setSelectedAreaId('')
    setIsAreaSelectOpen(true)
  }

  const handleConfirmArea = () => {
    if (!selectedAreaId) return
    setIsAreaSelectOpen(false)
    setIsGeoWizardOpen(true)
  }

  const selectedArea = areas.find((a) => a.id === selectedAreaId)
  const areaCampaigns = campaigns
    .filter((c) => c.area_seasons?.area_id === selectedAreaId)
    .map((c) => ({ id: c.id, name: c.name }))

  const allFormattedCampaigns = campaigns.map((c) => ({
    id: c.id,
    name: `${c.area_seasons?.areas?.farms?.name} > ${c.area_seasons?.areas?.name} > ${c.name}`,
  }))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Importação
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleGeoSelect}>
            <Map className="h-4 w-4 mr-2 text-muted-foreground" />
            Geografia
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsSoilWizardOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-muted-foreground" />
            Análise de Solo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isAreaSelectOpen} onOpenChange={setIsAreaSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Área</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Para qual área você deseja importar dados geográficos?</Label>
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAreaSelectOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmArea} disabled={!selectedAreaId}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isGeoWizardOpen && selectedArea && (
        <GeographicImportWizard
          open={isGeoWizardOpen}
          onOpenChange={setIsGeoWizardOpen}
          area={{ id: selectedArea.id, declared_area_ha: selectedArea.declared_area_ha }}
          campaigns={areaCampaigns}
          onSuccess={() => {
            setIsGeoWizardOpen(false)
            onImportSuccess()
          }}
        />
      )}

      {isSoilWizardOpen && (
        <ImportSoilWizard
          open={isSoilWizardOpen}
          onOpenChange={setIsSoilWizardOpen}
          campaigns={allFormattedCampaigns}
          onSuccess={() => {
            setIsSoilWizardOpen(false)
            onImportSuccess()
          }}
        />
      )}
    </>
  )
}
