import { supabase } from '@/lib/supabase/client'

type FarmAreaLocation = {
  id: string
  name?: string
  boundary?: any | null
  calculated_area_ha?: number | null
}

export type FarmLocation = {
  city: string
  state: string
  sourceAreaCount: number
  totalAreaCount: number
}

const BR_STATE_TO_UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
}

const geocodeCache = new Map<string, { city?: string; state?: string } | null>()

function removeAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeUf(state?: string | null) {
  if (!state) return undefined
  const clean = removeAccents(state).trim().toUpperCase()
  if (clean.length === 2) return clean
  return BR_STATE_TO_UF[clean] || state.trim()
}

function collectCoordinatePairs(value: any, pairs: number[][] = []) {
  if (!Array.isArray(value)) return pairs

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    pairs.push(value)
    return pairs
  }

  value.forEach((item) => collectCoordinatePairs(item, pairs))
  return pairs
}

function boundaryCentroid(boundary: any): { lat: number; lng: number } | null {
  const geom = boundary?.type === 'Feature' ? boundary.geometry : boundary
  const pairs = collectCoordinatePairs(geom?.coordinates)
  if (!pairs.length) return null

  const deduped = pairs.filter((pair, index) => {
    if (index === pairs.length - 1) return true
    const next = pairs[index + 1]
    return pair[0] !== next?.[0] || pair[1] !== next?.[1]
  })
  const usablePairs = deduped.length ? deduped : pairs
  const sum = usablePairs.reduce(
    (acc, pair) => ({ lng: acc.lng + pair[0], lat: acc.lat + pair[1] }),
    { lat: 0, lng: 0 },
  )

  return { lat: sum.lat / usablePairs.length, lng: sum.lng / usablePairs.length }
}

async function reverseGeocodePoint(lat: number, lng: number) {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) || null

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    )
    if (!res.ok) return null
    const geo = await res.json()
    const city =
      geo.address?.municipality ||
      geo.address?.city ||
      geo.address?.town ||
      geo.address?.village ||
      geo.address?.county
    const state = normalizeUf(geo.address?.state)
    const result = city || state ? { city, state } : null
    geocodeCache.set(cacheKey, result)
    return result
  } catch {
    geocodeCache.set(cacheKey, null)
    return null
  }
}

export async function resolveFarmLocationFromAreas(
  areas: FarmAreaLocation[],
): Promise<FarmLocation | null> {
  const areasWithBoundary = areas.filter((area) => area.boundary)
  if (!areasWithBoundary.length) return null

  const votes = new Map<string, { city: string; state: string; count: number; areaHa: number }>()

  for (const area of areasWithBoundary) {
    const centroid = boundaryCentroid(area.boundary)
    if (!centroid) continue

    const geo = await reverseGeocodePoint(centroid.lat, centroid.lng)
    if (!geo?.city && !geo?.state) continue

    const city = geo.city || ''
    const state = geo.state || ''
    const key = `${removeAccents(city).toUpperCase()}|${state.toUpperCase()}`
    const current = votes.get(key) || { city, state, count: 0, areaHa: 0 }
    current.count += 1
    current.areaHa += Number(area.calculated_area_ha || 0)
    votes.set(key, current)
  }

  const winner = Array.from(votes.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.areaHa - a.areaHa
  })[0]

  if (!winner) return null
  return {
    city: winner.city,
    state: winner.state,
    sourceAreaCount: winner.count,
    totalAreaCount: areasWithBoundary.length,
  }
}

export async function updateFarmLocationFromAreaMajority(farmId: string) {
  const { data, error } = await supabase.rpc('get_farm_map_data', { p_farm_id: farmId })
  if (error) throw error

  const areas = (((data as any)?.areas || []) as FarmAreaLocation[]).filter((area) => area.boundary)
  const location = await resolveFarmLocationFromAreas(areas)
  if (!location) return null

  const { error: updateError } = await supabase
    .from('farms')
    .update({ city: location.city || null, state: location.state || null })
    .eq('id', farmId)
  if (updateError) throw updateError

  return location
}
