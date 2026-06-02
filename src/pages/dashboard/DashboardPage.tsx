import { Link } from 'react-router-dom'
import { Users, UploadCloud, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema SIM Solo.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
            <CardDescription>Atalhos para fluxos frequentes do sistema</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1 h-12">
              <Link to="/produtores">
                <Users className="mr-2 h-4 w-4" />
                Cadastrar Produtor
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 h-12">
              <Link to="/importacoes">
                <UploadCloud className="mr-2 h-4 w-4" />
                Importar Dados
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores Agronômicos</CardTitle>
            <CardDescription>Resumo de análises e produtividade</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Os indicadores estarão disponíveis em breve</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
              Estatísticas e gráficos serão apresentados assim que os dados agronômicos começarem a
              ser coletados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
