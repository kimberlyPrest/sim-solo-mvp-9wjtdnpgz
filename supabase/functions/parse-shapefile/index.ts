import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import shp from 'npm:shpjs@4.0.4'
import proj4 from 'npm:proj4@2.15.0'
import * as turf from 'npm:@turf/turf@7.1.0'

proj4.defs('EPSG:32723', '+proj=utm +zone=23 +south +datum=WGS84 +units=m +no_defs')

const pointCodeKeys = ['ID', 'CODE', 'CODIGO', 'PONTO', 'id', 'code', 'codigo', 'ponto', 'name']
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const transformCoordinates = (coordinates: any, sourceProjection: string): any => {
  if (sourceProjection === 'EPSG:4326') return coordinates
  if (typeof coordinates[0] === 'number') {
    return proj4(sourceProjection, 'EPSG:4326', coordinates)
  }
  return coordinates.map((child: any) => transformCoordinates(child, sourceProjection))
}

const getPointCode = (properties: Record<string, unknown>, index: number) => {
  const key = pointCodeKeys.find((candidate) => properties[candidate] != null)
  const code = key ? String(properties[key]).trim() : ''
  if (!code) {
    throw new Error(`O ponto ${index + 1} não possui identificador no DBF.`)
  }
  return code
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      throw new Error('Autenticação obrigatória.')
    }

    const {
      storagePath,
      action = 'initial',
      declaredAreaHa,
      projection = 'EPSG:4326',
    } = await req.json()
    if (typeof storagePath !== 'string' || !storagePath.trim()) {
      throw new Error('Caminho do arquivo obrigatório.')
    }
    if (action !== 'initial') {
      throw new Error('A importação geográfica permite apenas a configuração inicial.')
    }

    const organizationId = storagePath.split('/')[0]
    if (!uuidPattern.test(organizationId)) {
      throw new Error('Caminho do arquivo inválido.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Sessão inválida.')
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('soil-imports')
      .download(storagePath)
    if (downloadError || !fileData) {
      throw new Error(`Falha ao baixar arquivo: ${downloadError?.message}`)
    }

    const geojson = await shp(await fileData.arrayBuffer())
    const layers = Array.isArray(geojson) ? geojson : [geojson]
    const features = layers.flatMap((layer: any) => layer.features || [])
    const polygonFeatures = features.filter((feature: any) =>
      ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type),
    )
    const pointFeatures = features.flatMap((feature: any) => {
      if (feature.geometry?.type === 'Point') return [feature]
      if (feature.geometry?.type !== 'MultiPoint') return []
      return feature.geometry.coordinates.map((coordinates: number[]) => ({
        ...feature,
        geometry: { type: 'Point', coordinates },
      }))
    })

    if (polygonFeatures.length > 1) {
      throw new Error('O ZIP deve conter exatamente um polígono ou multipolígono para o contorno.')
    }
    if (polygonFeatures.length === 0 || pointFeatures.length === 0) {
      throw new Error('A configuração inicial exige um contorno e ao menos um ponto.')
    }

    let boundary: any = null
    if (polygonFeatures.length === 1) {
      const geometry = polygonFeatures[0].geometry
      const coordinates = transformCoordinates(geometry.coordinates, projection)
      boundary =
        geometry.type === 'Polygon'
          ? { type: 'MultiPolygon', coordinates: [coordinates] }
          : { type: 'MultiPolygon', coordinates }
    }

    const points = pointFeatures.map((feature: any, index: number) => {
      const [lng, lat] = transformCoordinates(feature.geometry.coordinates, projection)
      return {
        code: getPointCode(feature.properties || {}, index),
        lng,
        lat,
      }
    })

    const uniqueCodes = new Set(points.map((point) => point.code))
    if (uniqueCodes.size !== points.length) {
      throw new Error('Os identificadores dos pontos devem ser únicos dentro do arquivo.')
    }

    const validationSummary = {
      boundaryValid: true,
      pointsInside: 0,
      pointsOutside: 0,
      outsideCodes: [] as string[],
    }
    let calculatedAreaHa = 0
    let divergencePct = 0

    if (boundary) {
      calculatedAreaHa = turf.area(turf.feature(boundary)) / 10_000
      if (declaredAreaHa) {
        divergencePct = (Math.abs(calculatedAreaHa - declaredAreaHa) / declaredAreaHa) * 100
      }

      points.forEach((point) => {
        if (
          turf.booleanPointInPolygon(turf.point([point.lng, point.lat]), turf.feature(boundary))
        ) {
          validationSummary.pointsInside += 1
        } else {
          validationSummary.pointsOutside += 1
          validationSummary.outsideCodes.push(point.code)
        }
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        boundary,
        points,
        calculatedAreaHa,
        divergencePct,
        validationSummary,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
