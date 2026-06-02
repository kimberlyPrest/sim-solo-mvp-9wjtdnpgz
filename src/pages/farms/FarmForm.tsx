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
  producer_id: z.string().min(1, 'Produtor é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  city: z.string().optional(),
  state: z.string().optional(),
  total_area_ha: z.coerce.number().optional(),
  notes: z.string().optional(),
})

export type FarmFormData = z.infer<typeof schema>

interface FarmFormProps {
  initialData?: Partial<FarmFormData>
  producers: { id: string; name: string }[]
  onSubmit: (data: FarmFormData) => void
  isSubmitting?: boolean
  onCancel?: () => void
}

export function FarmForm({
  initialData,
  producers,
  onSubmit,
  isSubmitting,
  onCancel,
}: FarmFormProps) {
  const form = useForm<FarmFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      producer_id: initialData?.producer_id || '',
      name: initialData?.name || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      total_area_ha: initialData?.total_area_ha || undefined,
      notes: initialData?.notes || '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="producer_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produtor</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!!initialData?.producer_id}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produtor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {producers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
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
              <FormLabel>Nome da Fazenda</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Fazenda Boa Vista" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado (UF)</FormLabel>
                <FormControl>
                  <Input maxLength={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="total_area_ha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Área Total (ha)</FormLabel>
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
            {isSubmitting ? 'Salvando...' : 'Salvar Fazenda'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
