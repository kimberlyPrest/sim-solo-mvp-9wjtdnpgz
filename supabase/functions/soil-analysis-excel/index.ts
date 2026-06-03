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

// Maps normalized (trimmed+uppercase) NUTRISIM column name variants to official attribute codes.
// The NUTRISIM planilhas may use abbreviated or differently-formatted headers.
const COLUMN_ALIASES: Record<string, string> = {
  PH: 'PH_H2O',
  'PH H2O': 'PH_H2O',
  'PH H₂O': 'PH_H2O',
  'PH (H2O)': 'PH_H2O',
  'PH AGUA': 'PH_H2O',
  'PH ÁGUA': 'PH_H2O',
  'PH CACL2': 'PH_CACL2',
  'PH CACL₂': 'PH_CACL2',
  'PH (CACL2)': 'PH_CACL2',
  'P REM': 'P_REM',
  'PREM': 'P_REM',
  FÓSFORO: 'P_MELICH',
  FOSFORO: 'P_MELICH',
  'P MELICH': 'P_MELICH',
  'P MEHLICH': 'P_MELICH',
  'P (MEHLICH)': 'P_MELICH',
  'P RESINA': 'P_RES',
  'P RESIN': 'P_RES',
  'P (RESINA)': 'P_RES',
  'MO': 'MO',
  'M.O': 'MO',
  'M.O.': 'MO',
  'MATERIA ORGANICA': 'MO',
  'MATÉRIA ORGÂNICA': 'MO',
  'K RESINA': 'K_RES',
  'K (RESINA)': 'K_RES',
  ENXOFRE: 'S',
  CALCIO: 'CA',
  CÁLCIO: 'CA',
  MAGNESIO: 'MG',
  MAGNÉSIO: 'MG',
  ALUMINIO: 'AL',
  ALUMÍNIO: 'AL',
  'H+AL': 'H_AL',
  'H + AL': 'H_AL',
  'H AL': 'H_AL',
  'SOMA DE BASES': 'SB',
  'CTC POTENCIAL': 'T',
  'CTC EFETIVA': 'T_EFETIVA',
  't': 'T_EFETIVA',
  'V%': 'V',
  'SAT. BASES': 'V',
  'SAT BASES': 'V',
  'M%': 'M',
  'SAT. ALUMINIO': 'M',
  'SAT ALUMINIO': 'M',
  'SAT. ALUMÍNIO': 'M',
  BORO: 'B',
  COBRE: 'CU',
  FERRO: 'FE',
  MANGANES: 'MN',
  MANGANÊS: 'MN',
  ZINCO: 'ZN',
}

// Tab name aliases for NUTRISIM historical planilhas and official template.
// Keys are normalized (trimmed+uppercase). Values are [depthFrom, depthTo].
const DEPTH_SHEET_ALIASES: [string[], number, number][] = [
  [['SOLO_0_20', '0.20', '0 A 20', '0-20', '0_20', 'SOLO 0 20', '0A20'], 0, 20],
  [['SOLO_20_40', '20.40', '20 A 40', '20-40', '20_40', 'SOLO 20 40', '20A40'], 20, 40],
]

// Recommendation tab aliases — detected but not imported by the soil analysis flow.
// These sheets will be surfaced in validationSummary.detectedRecommendationSheets
// for future use in the recommendations import flow (Phase E).
const RECOMMENDATION_SHEET_ALIASES: [string, string][] = [
  // [normalized alias, canonical name]
  ['RELCORE', 'RELCORE'],
  ['REL CORR', 'RELCORE'],
  ['RELCORRETIVO', 'RELCORE'],
  ['CORRETIVO', 'RELCORE'],
  ['RELNUTRI', 'RELNUTRI'],
  ['REL NUTRI', 'RELNUTRI'],
  ['RELNUTRICIONAL', 'RELNUTRI'],
  ['NUTRICIONAL', 'RELNUTRI'],
  ['REL ORG', 'RELORG'],
  ['RELORG', 'RELORG'],
  ['ORGANICO', 'RELORG'],
  ['ORGÂNICO', 'RELORG'],
  ['REL ORGANICO', 'RELORG'],
  ['REL ORGÂNICO', 'RELORG'],
  ['LEIA_ME', 'LEIA_ME'],
  ['LEIA ME', 'LEIA_ME'],
  ['README', 'LEIA_ME'],
]

// Returns canonical names of any recommendation/metadata sheets found in the workbook.
function detectRecommendationSheets(wb: XLSX.WorkBook): string[] {
  const found: string[] = []
  for (const sheetName of wb.SheetNames) {
    const upper = sheetName.trim().toUpperCase()
    const match = RECOMMENDATION_SHEET_ALIASES.find(([alias]) => upper === alias)
    if (match && !found.includes(match[1])) found.push(match[1])
  }
  return found
}

// Returns the worksheet and its depth range, or null if not found.
function findDepthSheet(
  wb: XLSX.WorkBook,
  depthFrom: number,
  depthTo: number,
): XLSX.WorkSheet | null {
  const aliases = DEPTH_SHEET_ALIASES.find(([, df, dt]) => df === depthFrom && dt === depthTo)
  if (!aliases) return null
  const [names] = aliases
  for (const sheetName of wb.SheetNames) {
    const upper = sheetName.trim().toUpperCase()
    if (names.some((alias) => upper === alias || upper.startsWith(alias))) {
      return wb.Sheets[sheetName]
    }
  }
  return null
}

// Normalizes a raw header cell value to an official attribute code or 'PONTO'.
function normalizeColumnName(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  const s = String(raw).trim().toUpperCase()
  if (s === 'PONTO') return 'PONTO'
  if (EXPECTED_COLUMNS.includes(s)) return s
  return COLUMN_ALIASES[s] ?? s
}

// Detects the header row index and the first data row index.
// The NUTRISIM format has a culture-name row before the header row,
// and a units row immediately after. Returns -1 if PONTO not found.
function detectHeaderRow(rows: unknown[][]): { headerIdx: number; dataStartIdx: number } {
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const hasPonto = rows[i].some(
      (cell) => typeof cell === 'string' && cell.trim().toUpperCase() === 'PONTO',
    )
    if (hasPonto) {
      // Check if the next row is a units row (contains '/' or known unit strings, no numeric values)
      const nextRow = rows[i + 1] ?? []
      const looksLikeUnits =
        nextRow.length > 0 &&
        nextRow.every((cell) => {
          if (cell === null || cell === undefined || cell === '') return true
          if (typeof cell === 'number') return false
          const s = String(cell)
          return (
            s.includes('/') ||
            /^(mg|cmol|g|%|-|dm|kg|ppm)/.test(s.toLowerCase()) ||
            /^\W*$/.test(s)
          )
        })
      return { headerIdx: i, dataStartIdx: looksLikeUnits ? i + 2 : i + 1 }
    }
  }
  return { headerIdx: -1, dataStartIdx: 0 }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new Error('Autenticação obrigatória.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser()
    if (userError || !user) throw new Error('Sessão inválida.')

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

      const supabase = supabaseAuth

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('soil-imports')
        .download(storagePath)
      if (downloadError || !fileData)
        throw new Error(`Falha ao baixar arquivo: ${downloadError?.message}`)

      const arrayBuffer = await fileData.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, {
        type: 'buffer',
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        cellText: false,
        bookVBA: false,
        bookDeps: false,
        bookProps: false,
        bookFiles: false,
        dense: true,
      })

      const ws0_20 = findDepthSheet(wb, 0, 20)
      const ws20_40 = findDepthSheet(wb, 20, 40)

      if (!ws0_20 && !ws20_40) {
        const found = wb.SheetNames.join(', ')
        throw new Error(
          `Nenhuma aba de análise encontrada. Abas no arquivo: [${found}]. ` +
            `Use os nomes SOLO_0_20 / SOLO_20_40 (template oficial) ou 0 a 20 / 20 a 40 (formato NUTRISIM).`,
        )
      }

      const { data: points, error: pointsError } = await supabase
        .from('sampling_points')
        .select('id, code')
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)

      if (pointsError) throw new Error('Erro ao buscar pontos da campanha')

      const pointMap = new Map<string, string>()
      ;(points ?? []).forEach((p: { id: string; code: string }) =>
        pointMap.set(String(p.code).trim().toUpperCase(), p.id),
      )

      type ParsedItem = {
        point_id: string | undefined
        code: string
        depth_from_cm: number
        depth_to_cm: number
        measurements: { attribute_code: string; numeric_value: number; text_value: null }[]
        errors: string[]
      }

      const parseSheet = (ws: XLSX.WorkSheet, depthFrom: number, depthTo: number): ParsedItem[] => {
        // Read all rows as raw arrays to handle multi-row headers (NUTRISIM format)
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        const { headerIdx, dataStartIdx } = detectHeaderRow(allRows)

        if (headerIdx === -1) return [] // no PONTO column found — skip sheet

        // Build normalized header array
        const headers = allRows[headerIdx].map(normalizeColumnName)
        const pontoColIdx = headers.indexOf('PONTO')
        if (pontoColIdx === -1) return []

        const knownCols = new Set(EXPECTED_COLUMNS)
        const unknownColsForSheet = new Set<string>()
        const results: ParsedItem[] = []

        for (let rowIdx = dataStartIdx; rowIdx < allRows.length; rowIdx++) {
          const row = allRows[rowIdx]
          if (!row || row.every((c) => c === null || c === undefined || c === '')) continue

          const pontoRaw = row[pontoColIdx]
          if (pontoRaw === null || pontoRaw === undefined || pontoRaw === '') continue

          const pontoStr = String(pontoRaw).trim().toUpperCase()
          const pointId = pointMap.get(pontoStr)

          const item: ParsedItem = {
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

          headers.forEach((attrCode, colIdx) => {
            if (colIdx === pontoColIdx || !attrCode) return
            if (!knownCols.has(attrCode)) {
              unknownColsForSheet.add(attrCode)
              return
            }
            const val = row[colIdx]
            if (val === null || val === undefined || val === '') return

            const numVal = Number(val)
            if (isNaN(numVal)) {
              item.errors.push(`Valor não numérico para ${attrCode}: "${val}"`)
            } else {
              item.measurements.push({ attribute_code: attrCode, numeric_value: numVal, text_value: null })
            }
          })

          results.push(item)
        }
        return results
      }

      const data0_20 = ws0_20 ? parseSheet(ws0_20, 0, 20) : []
      const data20_40 = ws20_40 ? parseSheet(ws20_40, 20, 40) : []

      const allData = [...data0_20, ...data20_40]

      // Collect unknown columns across both sheets for the validation summary
      const unknownCols = new Set<string>()
      const knownCols = new Set(EXPECTED_COLUMNS)
      const collectUnknown = (ws: XLSX.WorkSheet | null) => {
        if (!ws) return
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        const { headerIdx } = detectHeaderRow(allRows)
        if (headerIdx === -1) return
        allRows[headerIdx].forEach((cell) => {
          const norm = normalizeColumnName(cell)
          if (norm && norm !== 'PONTO' && !knownCols.has(norm)) unknownCols.add(String(cell))
        })
      }
      collectUnknown(ws0_20)
      collectUnknown(ws20_40)

      const detectedRecommendationSheets = detectRecommendationSheets(wb)

      const validationSummary = {
        totalRows: allData.length,
        matchedPoints: allData.filter((d) => !d.errors.some((e: string) => e.startsWith('Ponto')))
          .length,
        unmatchedPoints: allData.filter((d) => d.errors.some((e: string) => e.startsWith('Ponto')))
          .length,
        errors: allData.flatMap((d) => d.errors),
        unknownColumns: Array.from(unknownCols),
        // Recommendation sheets present in this workbook but not imported by this flow.
        // Surfaces RELCORE / RELNUTRI / Rel Org to the UI so it can inform the user.
        detectedRecommendationSheets,
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
