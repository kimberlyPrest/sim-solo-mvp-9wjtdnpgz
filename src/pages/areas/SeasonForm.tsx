import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({
  season_year: z.string().min(1, 'Ano/Safra é obrigatório'),
  label: z.string().optional(),
  crop: z.string().optional(),
  previous_crop: z.string().optional(),
  expected_productivity: z.coerce.number().optional(),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
})

export type SeasonFormData = z.infer<typeof schema>

interface SeasonFormProps {
  initialData?: Partial<SeasonFormData>
  onSubmit: (data: SeasonFormData) => void
  isSubmitting?: boolean
  onCancel?: () => void
}

export function SeasonForm({ initialData, onSubmit, isSubmitting, onCancel }: SeasonFormProps) {
  const form = useForm<SeasonFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      season_year: initialData?.season_year || '',
      label: initialData?.label || '',
      crop: initialData?.crop || '',
      previous_crop: initialData?.previous_crop || '',
      expected_productivity: initialData?.expected_productivity || undefined,
      start_date: initialData?.start_date || '',
      end_date: initialData?.end_date || '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="season_year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ano/Safra</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 2024/2025" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identificação da Safra</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Soja Verão" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="crop"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cultura</FormLabel>
                <FormControl>
                  <Input placeholder="Soja" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="previous_crop"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cultura Anterior</FormLabel>
                <FormControl>
                  <Input placeholder="Milho" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="expected_productivity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produtividade Esperada</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data Início</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data Fim</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar Safra'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
