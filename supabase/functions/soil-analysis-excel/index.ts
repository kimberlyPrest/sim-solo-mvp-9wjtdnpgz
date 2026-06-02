import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx'

const EXPECTED_COLUMNS = [
  'PONTO',
  'PH_H2O',
  'PH_CACL2',
  'P_REM',
  'MO',
  'P_MELICH',
  'P_RES',
  'K',
  'K_RES',
  'S',
  'CA',
  'MG',
  'AL',
  'H_AL',
  'SB',
  'T',
  'T_EFETIVA',
  'V',
  'M',
  'B',
  'CU',
  'FE',
  'MN',
  'ZN',
  'AREIA',
  'SILTE',
  'ARGILA',
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new Error('Autenticação obrigatória.')

    const body = await req.json()

    if (body.action === 'generate_template') {
      const wb = XLSX.utils.book_new()
      const header = EXPECTED_COLUMNS

      const ws0_20 = XLSX.utils.aoa_to_sheet([header])
      const ws20_40 = XLSX.utils.aoa_to_sheet([header])

      const wsReadme = XLSX.utils.aoa_to_sheet([
        ['INSTRUÇÕES DE PREENCHIMENTO'],
        ['1. Preencha a coluna PONTO com o identificador exato do ponto da campanha.'],
        ['2. Preencha os valores laboratoriais com números.'],
        ['3. Não altere o nome das abas SOLO_0_20 e SOLO_20_40.'],
        [],
        ['EXEMPLO:'],
        header,
        [
          'P01',
          5.5,
          5.0,
          10,
          2.5,
          15,
          12,
          0.3,
          0.2,
          5,
          2.0,
          1.0,
          0.1,
          2.0,
          3.3,
          5.3,
          3.4,
          62,
          3,
          0.5,
          1.2,
          40,
          5,
          2,
          40,
          30,
          30,
        ],
      ])

      XLSX.utils.book_append_sheet(wb, ws0_20, 'SOLO_0_20')
      XLSX.utils.book_append_sheet(wb, ws20_40, 'SOLO_20_40')
      XLSX.utils.book_append_sheet(wb, wsReadme, 'LEIA_ME')

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      return new Response(buf, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="template_analise_solo.xlsx"',
        },
      })
    }

    if (body.action === 'parse') {
      const { storagePath, campaignId, organizationId } = body
      if (!storagePath || !campaignId || !organizationId) throw new Error('Parâmetros inválidos')

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authorization } },
      })

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('soil-imports')
        .download(storagePath)
      if (downloadError || !fileData)
        throw new Error(`Falha ao baixar arquivo: ${downloadError?.message}`)

      const arrayBuffer = await fileData.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'buffer' })

      const ws0_20 = wb.Sheets['SOLO_0_20']
      const ws20_40 = wb.Sheets['SOLO_20_40']

      if (!ws0_20 && !ws20_40) {
        throw new Error('As abas SOLO_0_20 e SOLO_20_40 não foram encontradas.')
      }

      const { data: points, error: pointsError } = await supabase
        .from('sampling_points')
        .select('id, code')
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)

      if (pointsError) throw new Error('Erro ao buscar pontos da campanha')

      const pointMap = new Map()
      points.forEach((p: any) => pointMap.set(String(p.code).trim().toUpperCase(), p.id))

      const parseSheet = (ws: any, depthFrom: number, depthTo: number) => {
        if (!ws) return []
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[]
        const results = []

        for (const row of rawData) {
          const pontoRaw = row['PONTO'] ?? row['ponto']
          if (pontoRaw === null || pontoRaw === '') continue

          const pontoStr = String(pontoRaw).trim().toUpperCase()
          const pointId = pointMap.get(pontoStr)

          const item: any = {
            point_id: pointId,
            code: pontoStr,
            depth_from_cm: depthFrom,
            depth_to_cm: depthTo,
            measurements: [],
            errors: [],
          }

          if (!pointId) {
            item.errors.push(`Ponto ${pontoStr} não encontrado na campanha`)
          }

          const knownCols = new Set(EXPECTED_COLUMNS)

          Object.keys(row).forEach((key) => {
            const upperKey = key.toUpperCase()
            if (upperKey === 'PONTO') return

            if (knownCols.has(upperKey)) {
              const val = row[key]
              if (val !== null && val !== '') {
                const numVal = Number(val)
                if (isNaN(numVal)) {
                  item.errors.push(`Valor não numérico para ${key}`)
                } else {
                  item.measurements.push({
                    attribute_code: upperKey,
                    numeric_value: numVal,
                    text_value: null,
                  })
                }
              }
            }
          })

          results.push(item)
        }
        return results
      }

      const data0_20 = parseSheet(ws0_20, 0, 20)
      const data20_40 = parseSheet(ws20_40, 20, 40)

      const allData = [...data0_20, ...data20_40]

      const unknownCols = new Set<string>()
      const knownCols = new Set(EXPECTED_COLUMNS)
      const extractHeaders = (ws: any) => {
        if (!ws) return []
        const header = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]
        return header || []
      }
      const h1 = extractHeaders(ws0_20)
      const h2 = extractHeaders(ws20_40)

      ;[...h1, ...h2].forEach((h: string) => {
        if (h && typeof h === 'string') {
          const uH = h.toUpperCase()
          if (!knownCols.has(uH) && uH !== 'PONTO') {
            unknownCols.add(h)
          }
        }
      })

      const validationSummary = {
        totalRows: allData.length,
        matchedPoints: allData.filter((d) => !d.errors.some((e: string) => e.startsWith('Ponto')))
          .length,
        unmatchedPoints: allData.filter((d) => d.errors.some((e: string) => e.startsWith('Ponto')))
          .length,
        errors: allData.flatMap((d) => d.errors),
        unknownColumns: Array.from(unknownCols),
      }

      return new Response(JSON.stringify({ success: true, data: allData, validationSummary }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    throw new Error('Ação inválida')
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
