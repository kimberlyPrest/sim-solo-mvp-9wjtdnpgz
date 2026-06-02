import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'

export function AreaImportsTab({ areaId }: { areaId: string }) {
  const [imports, setImports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function loadImports() {
      const { data } = await supabase
        .from('imports')
        .select(`
          *,
          profiles!imports_created_by_fkey(full_name),
          import_files(original_name, file_path)
        `)
        .eq('area_id', areaId)
        .order('created_at', { ascending: false })

      setImports(data || [])
      setLoading(false)
    }
    loadImports()
  }, [areaId])

  async function handleDownload(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('soil-imports')
        .createSignedUrl(filePath, 60)
      if (error) throw error
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err: any) {
      toast({ title: 'Erro no download', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="animate-pulse h-32 bg-muted/20 rounded-xl"></div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold mb-4">Arquivos Importados</h2>

      {imports.length === 0 ? (
        <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed">
          <p className="text-muted-foreground">Nenhuma importação encontrada para esta área.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((imp) => {
                const file = Array.isArray(imp.import_files)
                  ? imp.import_files[0]
                  : imp.import_files

                return (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium">
                      {file?.original_name || 'Desconhecido'}
                    </TableCell>
                    <TableCell className="capitalize">
                      {imp.kind === 'geography' ? 'Geografia' : 'Análise de Solo'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(imp.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          imp.status === 'committed'
                            ? 'default'
                            : imp.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {imp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {file?.file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file.file_path)}
                        >
                          <Download className="h-4 w-4 mr-2" /> Baixar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
