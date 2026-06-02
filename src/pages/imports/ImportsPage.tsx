import { UploadCloud } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function ImportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importações</h1>
        <p className="text-muted-foreground">
          Histórico e central de processamento de arquivos externos.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Módulo em construção</h2>
          <p className="text-muted-foreground max-w-sm">
            A funcionalidade de importação de arquivos georreferenciados e análises de laboratório
            estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
