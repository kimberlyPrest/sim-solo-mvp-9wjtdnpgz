import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Preferências do sistema SIM Solo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geral</CardTitle>
          <CardDescription>Configurações de contexto de uso do sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Safra Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Define o escopo padrão para visualização de dados.
              </p>
            </div>
            <div className="font-medium">2025/2026</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Avisos de Inconsistência</Label>
              <p className="text-sm text-muted-foreground">
                Receber alertas quando laudos não baterem com o histórico.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>Gerenciamento de conexões com serviços externos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Supabase Storage</Label>
              <p className="text-sm text-muted-foreground text-primary flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span> Conectado
              </p>
            </div>
            <Button variant="outline" size="sm">
              Testar Conexão
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Serviço de Mapas (Leaflet/Tiles)</Label>
              <p className="text-sm text-muted-foreground text-primary flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span> Conectado
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configurar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
