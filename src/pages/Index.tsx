import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Tractor, Users, Map, Plus, UploadCloud, CheckCircle2 } from 'lucide-react'
import { getDashboardStats, getActivities } from '@/lib/api'
import type { Activity as ActivityType } from '@/lib/mock-data'

export default function Index() {
  const [stats, setStats] = useState<{
    totalProducers: number
    totalFarms: number
    totalAreas: number
    activeSeason: string
  } | null>(null)
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(), getActivities()]).then(([statsData, actsData]) => {
      setStats(statsData)
      setActivities(actsData)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema de prontuário agronômico.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/produtores">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar Produtor
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/importacao">
              <UploadCloud className="mr-2 h-4 w-4" /> Importar Análises
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produtores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalProducers}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fazendas Registradas</CardTitle>
            <Tractor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalFarms}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Áreas/Talhões</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalAreas}</div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Status do Sistema</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-primary/10" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">Online</div>
                <p className="text-xs text-primary/80 mt-1">{stats?.activeSeason}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas ações realizadas no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
                      <Activity className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.target} • {activity.user}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">{activity.date}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
            <CardDescription>Atalhos para fluxos comuns</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button variant="outline" className="justify-start h-12" asChild>
              <Link to="/produtores">
                <Users className="mr-2 h-4 w-4" /> Buscar Produtores
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-12" asChild>
              <Link to="/fazendas">
                <Tractor className="mr-2 h-4 w-4" /> Gerenciar Fazendas
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-12" asChild>
              <Link to="/importacao">
                <UploadCloud className="mr-2 h-4 w-4" /> Importar Shapefiles
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
