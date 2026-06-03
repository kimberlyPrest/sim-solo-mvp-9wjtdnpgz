import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UploadCloud,
  Map,
  Tractor,
  FileSpreadsheet,
  Activity,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { Tables } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<{
    producers: number
    farms: number
    areas: number
    hectares: number
    campaigns: number
    recentImports: (Tables<'imports'> & {
      import_files: { original_name: string } | { original_name: string }[] | null
    })[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      try {
        const { data: orgs } = await supabase
          .from('organization_members')
          .select('organization_id')
          .limit(1)
        const orgId = orgs?.[0]?.organization_id
        if (!orgId) return

        const [
          { count: producersCount },
          { count: farmsCount },
          { count: areasCount },
          { data: areasData },
          { count: campaignsCount },
          { data: recentImports },
        ] = await Promise.all([
          supabase
            .from('producers')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('farms')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('areas')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('areas')
            .select('calculated_area_ha, total_area_ha')
            .eq('organization_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('sampling_campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId),
          supabase
            .from('imports')
            .select(`
            id, kind, status, created_at, 
            import_files(original_name)
          `)
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const hectares =
          areasData?.reduce(
            (acc, area) => acc + Number(area.calculated_area_ha || area.total_area_ha || 0),
            0,
          ) || 0

        setMetrics({
          producers: producersCount || 0,
          farms: farmsCount || 0,
          areas: areasCount || 0,
          hectares: Math.round(hectares * 100) / 100,
          campaigns: campaignsCount || 0,
          recentImports: recentImports || [],
        })
      } catch (err) {
        console.error('Failed to load metrics', err)
      } finally {
        setLoading(false)
      }
    }
    loadMetrics()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema SIM Solo.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link className="text-[0.89rem]" to="/produtores">
              <Users className="mr-2 h-4 w-4" />
              Cadastrar Produtor
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/importacoes">
              <UploadCloud className="mr-2 h-4 w-4" />
              Importar Dados
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-24 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produtores Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.producers ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fazendas Ativas</CardTitle>
                <Tractor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.farms ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Áreas Registradas</CardTitle>
                <Map className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.areas ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hectares Mapeados</CardTitle>
                <Map className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.hectares ?? 0} ha</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Campanhas Analisadas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.campaigns ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-2 md:col-span-1">
              <CardHeader>
                <CardTitle>Atividades Recentes</CardTitle>
                <CardDescription>Últimas importações de dados no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {!metrics?.recentImports?.length ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-3" />
                    <p>Nenhuma importação encontrada.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metrics.recentImports.map((imp) => {
                      const fileName = Array.isArray(imp.import_files)
                        ? imp.import_files[0]?.original_name
                        : imp.import_files?.original_name
                      return (
                        <div key={imp.id} className="flex items-center gap-4">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <FileSpreadsheet className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {fileName || 'Arquivo desconhecido'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {imp.kind === 'geography' ? 'Geografia' : 'Análise de Solo'} •{' '}
                              {format(new Date(imp.created_at), "dd 'de' MMM, HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          <div className="text-sm capitalize font-medium px-2 py-1 bg-muted rounded-md">
                            {imp.status}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
