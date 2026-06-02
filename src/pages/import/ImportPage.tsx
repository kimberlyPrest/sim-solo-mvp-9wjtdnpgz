import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { UploadCloud, FileType, CheckCircle2 } from 'lucide-react'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { toast } = useToast()

  const handleUpload = () => {
    if (!file) return
    setUploading(true)
    // Mock upload delay
    setTimeout(() => {
      setUploading(false)
      setSuccess(true)
      toast({
        title: 'Importação Concluída',
        description: 'Os dados foram processados e integrados ao prontuário.',
      })
      setTimeout(() => {
        setSuccess(false)
        setFile(null)
      }, 3000)
    }, 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de Importação</h1>
        <p className="text-muted-foreground">
          Faça o upload de laudos laboratoriais ou contornos de área.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Lote de Dados</CardTitle>
          <CardDescription>
            Selecione o tipo de dado e o arquivo correspondente no padrão SIM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="data-type">Tipo de Dado</Label>
            <Select defaultValue="lab">
              <SelectTrigger id="data-type">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab">Resultados de Laboratório (CSV/XLSX)</SelectItem>
                <SelectItem value="geo">Contornos de Área (Shapefile/GeoJSON)</SelectItem>
                <SelectItem value="rec">Recomendações Técnicas (Planilha)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
            >
              {success ? (
                <div className="flex flex-col items-center text-primary animate-in zoom-in">
                  <CheckCircle2 className="h-10 w-10 mb-2" />
                  <p className="font-medium">Arquivo Processado com Sucesso</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center">
                  <FileType className="h-10 w-10 text-primary mb-2" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="mt-2 text-destructive"
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="font-medium mb-1">Arraste e solte o arquivo aqui</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    ou clique para selecionar do computador
                  </p>
                  <Input
                    type="file"
                    className="max-w-[250px]"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Nota: O arquivo original será salvo no bucket seguro para rastreabilidade.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/50 px-6 py-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!file || uploading || success}
            onClick={handleUpload}
          >
            {uploading
              ? 'Processando e Validando...'
              : success
                ? 'Concluído'
                : 'Processar Importação'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
