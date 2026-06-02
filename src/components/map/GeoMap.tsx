import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

const pointIcon = L.divIcon({
  className: 'custom-point-icon',
  html: '<div style="width:14px;height:14px;background:hsl(var(--primary));border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function MapBounds({ boundary, points }: { boundary?: any; points?: any[] }) {
  const map = useMap()

  useEffect(() => {
    if (!boundary && (!points || points.length === 0)) return

    const bounds = L.latLngBounds([])

    if (boundary) {
      const geojson = L.geoJSON(boundary)
      bounds.extend(geojson.getBounds())
    }

    if (points && points.length > 0) {
      points.forEach((p) => {
        if (p.lat && p.lng) {
          bounds.extend([p.lat, p.lng])
        }
      })
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [map, boundary, points])

  return null
}

export function GeoMap({
  boundary,
  points,
  height = '400px',
}: {
  boundary?: any
  points?: any[]
  height?: string
}) {
  return (
    <div style={{ height, width: '100%', borderRadius: '0.5rem', overflow: 'hidden', zIndex: 0 }}>
      <MapContainer
        center={[-15, -50]}
        zoom={4}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {boundary && (
          <GeoJSON
            data={boundary}
            style={{
              color: 'hsl(var(--primary))',
              weight: 2,
              fillColor: 'hsl(var(--primary))',
              fillOpacity: 0.15,
            }}
          />
        )}
        {points?.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={pointIcon}>
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <span className="font-semibold">{p.code}</span>
            </Tooltip>
          </Marker>
        ))}
        <MapBounds boundary={boundary} points={points} />
      </MapContainer>
    </div>
  )
}
