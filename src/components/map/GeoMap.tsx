import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

export type SoilCategory = 'low' | 'medium' | 'adequate' | 'high'

export type SoilPointData = {
  id?: string
  code: string
  lat: number
  lng: number
  value?: number | null
  category?: SoilCategory
}

export type MapFeature = {
  id: string
  name: string
  boundary: any
  color?: string
  active?: boolean
}

const CATEGORY_COLORS: Record<SoilCategory, { fill: string; border: string }> = {
  low: { fill: '#ef4444', border: '#dc2626' },
  medium: { fill: '#f97316', border: '#ea580c' },
  adequate: { fill: '#22c55e', border: '#16a34a' },
  high: { fill: '#3b82f6', border: '#2563eb' },
}

const CATEGORY_LABELS: Record<SoilCategory, string> = {
  low: 'Baixo',
  medium: 'Médio',
  adequate: 'Adequado',
  high: 'Alto',
}

const TILE_URLS = {
  roadmap: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const

const TILE_ATTRS = {
  roadmap:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: 'Tiles &copy; Esri',
} as const

const TILE_CLASSES: Record<keyof typeof TILE_URLS, string | undefined> = {
  roadmap: 'leaflet-roadmap-green-tile',
  dark: undefined,
  satellite: undefined,
}

type TileStyle = keyof typeof TILE_URLS

const MIN_POINT_SIZE = 4
const MAX_POINT_SIZE = 14
const DEFAULT_POINT_SIZE = 7
const POINT_BOUNDARY_RATIO = 0.035

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function extendGeoJsonBounds(bounds: L.LatLngBounds, geometry?: any) {
  if (!geometry) return
  try {
    bounds.extend(L.geoJSON(geometry).getBounds())
  } catch (_e) {
    /* ignore invalid geometry */
  }
}

function makePointIcon(category?: SoilCategory, size = DEFAULT_POINT_SIZE) {
  const colors = category
    ? CATEGORY_COLORS[category]
    : { fill: 'hsl(85 72% 52%)', border: 'hsl(85 72% 38%)' }
  const borderWidth = size <= 7 ? 1 : 2
  const shadow = size >= 8 ? `box-shadow:0 0 ${Math.round(size * 0.45)}px ${colors.fill}80;` : ''

  return L.divIcon({
    className: 'sampling-point-marker',
    html: `<div style="box-sizing:border-box;width:${size}px;height:${size}px;background:${colors.fill};border-radius:50%;border:${borderWidth}px solid ${colors.border};${shadow}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function getRenderedGeometryBounds(
  features?: MapFeature[],
  boundary?: any,
  points?: SoilPointData[],
) {
  const bounds = L.latLngBounds([])

  features?.forEach((f) => extendGeoJsonBounds(bounds, f.boundary))
  extendGeoJsonBounds(bounds, boundary)

  if (!bounds.isValid()) {
    points?.forEach((p) => {
      if (p.lat && p.lng) bounds.extend([p.lat, p.lng])
    })
  }

  return bounds
}

function useResponsivePointSize({
  features,
  boundary,
  points,
}: {
  features?: MapFeature[]
  boundary?: any
  points?: SoilPointData[]
}) {
  const map = useMap()
  const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE)

  useEffect(() => {
    function updatePointSize() {
      const zoomSize = clamp(Math.round(map.getZoom() * 1.25 - 10), MIN_POINT_SIZE, MAX_POINT_SIZE)
      const bounds = getRenderedGeometryBounds(features, boundary, points)
      let nextSize = zoomSize

      if (bounds.isValid()) {
        const nw = map.latLngToContainerPoint(bounds.getNorthWest())
        const se = map.latLngToContainerPoint(bounds.getSouthEast())
        const renderedWidth = Math.abs(se.x - nw.x)
        const renderedHeight = Math.abs(se.y - nw.y)
        const smallestRenderedSide = Math.min(renderedWidth, renderedHeight)
        const boundaryCap = clamp(
          Math.floor(smallestRenderedSide * POINT_BOUNDARY_RATIO),
          MIN_POINT_SIZE,
          MAX_POINT_SIZE,
        )
        nextSize = Math.min(zoomSize, boundaryCap)
      }

      setPointSize((current) => (current === nextSize ? current : nextSize))
    }

    updatePointSize()
    map.on('zoomend moveend resize', updatePointSize)
    return () => {
      map.off('zoomend moveend resize', updatePointSize)
    }
  }, [map, features, boundary, points])

  return pointSize
}

function MapBounds({
  features,
  boundary,
  points,
}: {
  features?: MapFeature[]
  boundary?: any
  points?: SoilPointData[]
}) {
  const map = useMap()

  useEffect(() => {
    const bounds = getRenderedGeometryBounds(features, boundary, points)

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [map, features, boundary, points])

  return null
}

function PointMarkers({
  points,
  features,
  boundary,
}: {
  points?: SoilPointData[]
  features?: MapFeature[]
  boundary?: any
}) {
  const pointSize = useResponsivePointSize({ features, boundary, points })

  if (!points?.length) return null

  return (
    <>
      {points.map((p, index) => (
        <Marker
          key={p.id || `${p.code}-${p.lat}-${p.lng}-${index}`}
          position={[p.lat, p.lng]}
          icon={makePointIcon(p.category, pointSize)}
        >
          <Popup>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                color: 'hsl(120 10% 90%)',
                minWidth: 100,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'hsl(85 72% 60%)' }}>
                Ponto {p.code}
              </div>
              {p.value != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'hsl(120 8% 55%)' }}>valor</span>
                  <span style={{ fontWeight: 500 }}>
                    {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                  </span>
                </div>
              )}
              {p.category && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 2,
                  }}
                >
                  <span style={{ color: 'hsl(120 8% 55%)' }}>classe</span>
                  <span style={{ color: CATEGORY_COLORS[p.category].fill, fontWeight: 500 }}>
                    {CATEGORY_LABELS[p.category]}
                  </span>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function Legend({ categories }: { categories: SoilCategory[] }) {
  if (categories.length === 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 12,
        zIndex: 30,
        background: 'rgba(7,15,6,0.85)',
        border: '1px solid rgba(165,230,58,0.2)',
        borderRadius: 8,
        padding: '8px 12px',
        pointerEvents: 'none',
      }}
    >
      {categories.map((cat) => (
        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: CATEGORY_COLORS[cat].fill,
              boxShadow: `0 0 4px ${CATEGORY_COLORS[cat].fill}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: 'hsl(120 10% 80%)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </span>
        </div>
      ))}
    </div>
  )
}

export function GeoMap({
  boundary,
  features,
  points,
  height = '400px',
  tileStyle = 'roadmap',
  showLegend = true,
  onFeatureClick,
  selectedFeatureId,
}: {
  boundary?: any
  features?: MapFeature[]
  points?: SoilPointData[]
  height?: string
  tileStyle?: TileStyle
  showLegend?: boolean
  onFeatureClick?: (id: string) => void
  selectedFeatureId?: string
}) {
  const presentCategories = useMemo<SoilCategory[]>(() => {
    if (!points || points.length === 0) return []
    const cats = new Set<SoilCategory>()
    points.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats)
  }, [points])

  const primaryColor = 'hsl(85, 72%, 52%)'

  return (
    <div
      style={{
        height,
        width: '100%',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        zIndex: 0,
        position: 'relative',
      }}
    >
      <MapContainer
        center={[-15, -50]}
        zoom={4}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl
      >
        <TileLayer
          key={tileStyle}
          attribution={TILE_ATTRS[tileStyle]}
          url={TILE_URLS[tileStyle]}
          className={TILE_CLASSES[tileStyle]}
          maxZoom={19}
        />

        {/* Single boundary (backward compat) */}
        {boundary && !features && (
          <GeoJSON
            data={boundary}
            style={{
              color: primaryColor,
              weight: 2,
              fillColor: primaryColor,
              fillOpacity: 0.15,
            }}
          />
        )}
        {/* Multiple area features */}
        {features?.map((f) => {
          if (!f.boundary) return null
          const isSelected = f.id === selectedFeatureId
          const color = f.color || primaryColor
          return (
            <GeoJSON
              key={f.id}
              data={f.boundary}
              style={{
                color: isSelected ? primaryColor : color,
                weight: isSelected ? 3 : 2,
                fillColor: color,
                fillOpacity: isSelected ? 0.35 : 0.18,
              }}
              eventHandlers={{
                click: () => onFeatureClick?.(f.id),
              }}
            >
              <Popup>
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: 'hsl(120 10% 90%)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
                </div>
              </Popup>
            </GeoJSON>
          )
        })}

        {/* Sampling points */}
        <PointMarkers points={points} features={features} boundary={boundary} />
        <MapBounds features={features} boundary={boundary} points={points} />
      </MapContainer>
      {showLegend && presentCategories.length > 0 && <Legend categories={presentCategories} />}
    </div>
  )
}

/* Utility: classify points by relative quartiles of dataset values */
export function classifyPoints(points: Omit<SoilPointData, 'category'>[]): SoilPointData[] {
  const withValues = points.filter((p) => p.value != null)
  if (withValues.length === 0) return points.map((p) => ({ ...p }))

  const sorted = [...withValues].sort((a, b) => (a.value as number) - (b.value as number))
  const n = sorted.length
  const q1 = (sorted[Math.floor(n * 0.25)]?.value as number) ?? -Infinity
  const q2 = (sorted[Math.floor(n * 0.5)]?.value as number) ?? -Infinity
  const q3 = (sorted[Math.floor(n * 0.75)]?.value as number) ?? -Infinity

  return points.map((p) => {
    if (p.value == null) return { ...p }
    let category: SoilCategory
    if (p.value <= q1) category = 'low'
    else if (p.value <= q2) category = 'medium'
    else if (p.value <= q3) category = 'adequate'
    else category = 'high'
    return { ...p, category }
  })
}
