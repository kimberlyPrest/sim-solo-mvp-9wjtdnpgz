import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

export type SoilCategory = 'low' | 'medium' | 'adequate' | 'high'

export type SoilPointData = {
  id: string
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
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}

const TILE_ATTRS = {
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: 'Tiles &copy; Esri',
}

function makePointIcon(category?: SoilCategory, size = 14) {
  const colors = category
    ? CATEGORY_COLORS[category]
    : { fill: 'hsl(85 72% 52%)', border: 'hsl(85 72% 38%)' }
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${colors.fill};border-radius:50%;border:2px solid ${colors.border};box-shadow:0 0 6px ${colors.fill}80;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
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
    const bounds = L.latLngBounds([])

    features?.forEach((f) => {
      if (f.boundary) {
        try {
          bounds.extend(L.geoJSON(f.boundary).getBounds())
        } catch {}
      }
    })

    if (boundary) {
      try {
        bounds.extend(L.geoJSON(boundary).getBounds())
      } catch {}
    }

    points?.forEach((p) => {
      if (p.lat && p.lng) bounds.extend([p.lat, p.lng])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [map, features, boundary, points])

  return null
}

function Legend({ categories }: { categories: SoilCategory[] }) {
  if (categories.length === 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 12,
        zIndex: 1000,
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
  tileStyle = 'dark',
  showLegend = true,
  onFeatureClick,
  selectedFeatureId,
}: {
  boundary?: any
  features?: MapFeature[]
  points?: SoilPointData[]
  height?: string
  tileStyle?: 'dark' | 'satellite'
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
        {points?.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={makePointIcon(p.category)}>
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
