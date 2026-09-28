import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RoleState } from '../App'
import { apiFetch } from '../api/client'

// Leaflet CSS must be imported
import 'leaflet/dist/leaflet.css'

interface SpotCorrelation {
  cluster_id: string
  primary_name: string | null
  confidence_score: number
  syndicate_flag: boolean
  match_reasons: string[]
  reasoning_gloss: string | null
}

interface SpotPoint {
  fir_id: number
  fir_number: string
  lat: number
  lon: number
  crime_category: string
  station_name: string
  district: string
  occurrence_date: string | null
  fir_date_time: string | null
  complainant_name: string | null
  occurrence_address: string | null
  narrative: string | null
  modus_operandi: string | null
  correlation: SpotCorrelation | null
}

interface GeoData {
  spots: SpotPoint[]
  heatmap: Array<{ lat: number; lon: number; weight: number }>
}

const CRIME_COLORS: Record<string, string> = {
  'Theft': '#a16207',
  'Assault': '#b91c1c',
  'Robbery': '#9f1239',
  'Cyber Fraud': '#3e4c59',
  'Fraud': '#9a3412',
  'Murder': '#7f1d1d',
  'Kidnapping': '#881337',
  'POCSO': '#9f1239',
  'Dowry Harassment': '#92400e',
}

function getCategoryColor(cat: string): string {
  return CRIME_COLORS[cat] || '#3e4c59'
}

export default function CrimeMap({ rbac }: { rbac: RoleState }) {
  const navigate = useNavigate()
  const [geoData, setGeoData] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [layerMode, setLayerMode] = useState<'spots' | 'heatmap'>('spots')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [MapComponents, setMapComponents] = useState<any>(null)

  // Lazy-load leaflet components (browser only)
  useEffect(() => {
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([rl, L]) => {
      // Fix default icon paths
      delete (L.default.Icon.Default.prototype as any)._getIconUrl
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })
      setMapComponents({ L: L.default, ...rl })
    })
  }, [])

  useEffect(() => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    setLoading(true)
    const params: Record<string, string> = {}
    if (categoryFilter) params.crime_category = categoryFilter
    apiFetch<GeoData>('/heatmap', rbac.role, rbac.stationId, params)
      .then(setGeoData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId, categoryFilter])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="state-empty">Select a station to view map.</div>
  }

  if (loading) return <div className="state-empty">Loading map…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

  const categories = geoData
    ? [...new Set(geoData.spots.map((s) => s.crime_category))].sort()
    : []

  const { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } = MapComponents || {}

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">UP Crime Map</h1>
        <div className="flex items-center gap-2">
          <div className="seg">
            <button
              className={`seg-btn ${layerMode === 'spots' ? 'seg-btn-on' : ''}`}
              onClick={() => setLayerMode('spots')}
            >
              Spot Pins
            </button>
            <button
              className={`seg-btn ${layerMode === 'heatmap' ? 'seg-btn-on' : ''}`}
              onClick={() => setLayerMode('heatmap')}
            >
              Heatmap
            </button>
          </div>
          <select
            className="select-inline"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="text-2xs text-zinc-500">
        {geoData?.spots.length ?? 0} FIRs plotted · {geoData?.heatmap.length ?? 0} heat points
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200" style={{ height: '580px' }}>
        {MapComponents && geoData && MapContainer ? (
          <MapContainer
            center={[26.8467, 80.9462]}  // Lucknow (UP center approximation)
            zoom={7}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {layerMode === 'spots' && geoData.spots.map((spot) => (
              <CircleMarker
                key={spot.fir_id}
                center={[spot.lat, spot.lon]}
                radius={6}
                pathOptions={{
                  fillColor: getCategoryColor(spot.crime_category),
                  color: '#fff',
                  weight: 1,
                  opacity: 0.9,
                  fillOpacity: 0.8,
                }}
              >
                {/* Hover: brief info */}
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="text-xs">
                    <span className="font-semibold font-mono">{spot.fir_number}</span> · {spot.crime_category}
                    {spot.correlation && (
                      <span className="ml-1 text-zinc-500">
                        {spot.correlation.syndicate_flag ? 'Syndicate' : 'Linked'}
                      </span>
                    )}
                  </div>
                </Tooltip>

                {/* Click: full metadata popup */}
                <Popup minWidth={260}>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold font-mono text-sm">{spot.fir_number}</div>
                    <div>{spot.crime_category}</div>
                    <div className="text-gray-500">{spot.station_name} · {spot.district}</div>
                    {spot.fir_date_time && <div className="text-gray-400">{spot.fir_date_time.replace('T', ' ').slice(0, 16)}</div>}
                    {spot.complainant_name && <div><span className="text-gray-400">Complainant: </span>{spot.complainant_name}</div>}
                    {spot.occurrence_address && <div><span className="text-gray-400">Address: </span>{spot.occurrence_address}</div>}
                    {spot.modus_operandi && (
                      <div className="pt-1 border-t border-gray-100">
                        <span className="text-gray-400">Modus operandi: </span>{spot.modus_operandi}
                      </div>
                    )}

                    {spot.correlation && (
                      <div className="pt-1.5 mt-1 border-t border-gray-200">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-semibold">Pattern match</span>
                          {spot.correlation.syndicate_flag && <span className="rounded-sm bg-red-50 px-1 text-red-800 ring-1 ring-inset ring-red-200">Syndicate</span>}
                          <span className="text-gray-500">({Math.round(spot.correlation.confidence_score * 100)}%)</span>
                        </div>
                        {spot.correlation.primary_name && <div className="text-gray-600">{spot.correlation.primary_name}</div>}
                        {spot.correlation.reasoning_gloss && (
                          <p className="text-gray-700 italic border-l-2 border-blue-300 pl-1.5 mt-1">{spot.correlation.reasoning_gloss}</p>
                        )}
                        <ul className="mt-0.5 space-y-0.5">
                          {spot.correlation.match_reasons.map((r, i) => (
                            <li key={i} className="rounded-sm bg-zinc-50 px-1 py-0.5 text-zinc-600 ring-1 ring-inset ring-zinc-200">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => navigate(`/firs/${spot.fir_id}`)}
                      className="btn btn-primary mt-1.5 w-full"
                    >
                      Go to FIR page
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {layerMode === 'heatmap' && geoData.heatmap.map((pt, i) => (
              <CircleMarker
                key={i}
                center={[pt.lat, pt.lon]}
                radius={Math.min(30, 8 + pt.weight * 3)}
                pathOptions={{
                  fillColor: '#9f1239',
                  color: 'transparent',
                  fillOpacity: Math.min(0.7, 0.2 + pt.weight * 0.05),
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="text-xs">{pt.weight} FIR{pt.weight !== 1 ? 's' : ''} here</div>
                </Tooltip>
                <Popup>
                  <div className="text-xs">{pt.weight} FIRs at this station</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-zinc-400">
            Loading map components…
          </div>
        )}
      </div>
    </div>
  )
}
