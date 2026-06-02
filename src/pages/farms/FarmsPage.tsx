import { Tractor } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function FarmsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fazendas</h1>
        <p className="text-muted-foreground">
          Gestão de propriedades rurais e unidades de produção.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Tractor className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Nenhum dado encontrado</h2>
          <p className="text-muted-foreground max-w-sm">
            O módulo de fazendas está em construção. Em breve você poderá cadastrar e organizar o
            portfólio de propriedades rurais.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
