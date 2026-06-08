export type SoilAttribute = {
  code: string
  name: string
}

export const SOIL_ATTRIBUTES: SoilAttribute[] = [
  { code: 'PH_H2O', name: 'pH H2O' },
  { code: 'PH_CACL2', name: 'pH CaCl2' },
  { code: 'P_REM', name: 'P rem' },
  { code: 'MO', name: 'Materia organica' },
  { code: 'P_MELICH', name: 'P Mehlich' },
  { code: 'P_RES', name: 'P resina' },
  { code: 'K', name: 'Potassio' },
  { code: 'K_RES', name: 'K resina' },
  { code: 'S', name: 'Enxofre' },
  { code: 'CA', name: 'Calcio' },
  { code: 'MG', name: 'Magnesio' },
  { code: 'AL', name: 'Aluminio' },
  { code: 'H_AL', name: 'H + Al' },
  { code: 'SB', name: 'Soma de bases' },
  { code: 'T', name: 'CTC' },
  { code: 'T_EFETIVA', name: 'CTC efetiva' },
  { code: 'V', name: 'V%' },
  { code: 'M', name: 'm%' },
  { code: 'B', name: 'Boro' },
  { code: 'CU', name: 'Cobre' },
  { code: 'FE', name: 'Ferro' },
  { code: 'MN', name: 'Manganes' },
  { code: 'ZN', name: 'Zinco' },
  { code: 'AREIA', name: 'Areia' },
  { code: 'SILTE', name: 'Silte' },
  { code: 'ARGILA', name: 'Argila' },
]

export const SOIL_ATTRIBUTE_COLUMNS: Record<string, string> = {
  PH_H2O: 'ph_h2o',
  PH_CACL2: 'ph_cacl2',
  P_REM: 'p_rem',
  MO: 'mo',
  P_MELICH: 'p_melich',
  P_RES: 'p_res',
  K: 'k',
  K_RES: 'k_res',
  S: 's',
  CA: 'ca',
  MG: 'mg',
  AL: 'al',
  H_AL: 'h_al',
  SB: 'sb',
  T: 't_ctc',
  T_EFETIVA: 't_efetiva',
  V: 'v_pct',
  M: 'm_pct',
  B: 'b',
  CU: 'cu',
  FE: 'fe',
  MN: 'mn',
  ZN: 'zn',
  AREIA: 'areia',
  SILTE: 'silte',
  ARGILA: 'argila',
}

export function getFirstSoilAttributeCode(rows: any[] = []) {
  for (const row of rows) {
    for (const measurement of row.measurements || []) {
      const code = measurement?.attribute_code
      const value = measurement?.numeric_value
      if (
        code &&
        SOIL_ATTRIBUTE_COLUMNS[code] &&
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !Number.isNaN(Number(value))
      ) {
        return code
      }
    }
  }

  return SOIL_ATTRIBUTES[0]?.code || ''
}
