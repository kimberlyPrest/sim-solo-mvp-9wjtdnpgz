import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({
  farm_id: z.string().min(1, 'Fazenda é obrigatória'),
  name: z.string().min(1, 'Nome é obrigatório'),
  declared_area_ha: z.coerce.number().optional(),
  notes: z.string().optional(),
})

export type AreaFormData = z.infer<typeof schema>

interface AreaFormProps {
  initialData?: Partial<AreaFormData>
  farms: { id: string; name: string }[]
  onSubmit: (data: AreaFormData) => void
  isSubmitting?: boolean
  onCancel?: () => void
}

export function AreaForm({ initialData, farms, onSubmit, isSubmitting, onCancel }: AreaFormProps) {
  const form = useForm<AreaFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      farm_id: initialData?.farm_id || '',
      name: initialData?.name || '',
      declared_area_ha: initialData?.declared_area_ha || undefined,
      notes: initialData?.notes || '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="farm_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fazenda</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!!initialData?.farm_id}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma fazenda" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {farms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Talhão / Área</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Talhão 01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="declared_area_ha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Área Declarada (ha)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar Área'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
