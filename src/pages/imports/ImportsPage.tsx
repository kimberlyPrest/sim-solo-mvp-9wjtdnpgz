import { useEffect, useState } from 'react'
import { UploadCloud, FileSpreadsheet, Map, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ImportsPage() {
  const { organization } = useAuth()
  const [imports, setImports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadImports() {
      if (!organization) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('imports')
          .select(`
            id, kind, status, created_at,
            import_files(original_name),
            profiles!imports_created_by_fkey(full_name, email)
          `)
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) setImports(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadImports()
  }, [organization])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importações</h1>
        <p className="text-muted-foreground">
          Histórico e central de processamento de arquivos externos.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Nenhuma importação encontrada</h3>
              <p className="text-sm text-muted-foreground">
                Importações de geografias ou análises aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Importado por</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((imp) => {
                    const fileName = Array.isArray(imp.import_files)
                      ? imp.import_files[0]?.original_name
                      : imp.import_files?.original_name

                    const userName = imp.profiles?.full_name || imp.profiles?.email || 'Sistema'

                    return (
                      <TableRow key={imp.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          {imp.kind === 'geography' ? (
                            <Map className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          )}
                          {fileName || 'Arquivo desconhecido'}
                        </TableCell>
                        <TableCell>
                          {imp.kind === 'geography' ? 'Geografia' : 'Análise de Solo'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={imp.status === 'committed' ? 'default' : 'secondary'}>
                            {imp.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{userName}</TableCell>
                        <TableCell>
                          {format(new Date(imp.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
