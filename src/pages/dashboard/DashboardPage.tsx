import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Map, Tractor, Leaf } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<{
    producers: number
    farms: number
    areas: number
    hectares: number
    seasons: number
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
          { count: seasonsCount },
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
            .select('calculated_area_ha')
            .eq('organization_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('area_seasons')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId),
        ])

        const hectares =
          areasData?.reduce((acc, area) => acc + Number(area.calculated_area_ha || 0), 0) || 0

        setMetrics({
          producers: producersCount || 0,
          farms: farmsCount || 0,
          areas: areasCount || 0,
          hectares: Math.round(hectares * 100) / 100,
          seasons: seasonsCount || 0,
        })
      } catch (err) {
        console.error('Failed to load metrics', err)
      } finally {
        setLoading(false)
      }
    }
    loadMetrics()
  }, [])

  const MetricCard = ({
    title,
    value,
    icon: Icon,
  }: {
    title: string
    value: number | string
    icon: React.ElementType
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema SIM Solo.</p>
        </div>
        <Button asChild>
          <Link className="text-[0.89rem]" to="/produtores">
            <Users className="mr-2 h-4 w-4" />
            Cadastrar Produtor
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Produtores Ativos" value={metrics?.producers ?? 0} icon={Users} />
          <MetricCard title="Fazendas Ativas" value={metrics?.farms ?? 0} icon={Tractor} />
          <MetricCard title="Áreas Registradas" value={metrics?.areas ?? 0} icon={Map} />
          <MetricCard title="Safras Cadastradas" value={metrics?.seasons ?? 0} icon={Leaf} />
        </div>
      )}
    </div>
  )
}
