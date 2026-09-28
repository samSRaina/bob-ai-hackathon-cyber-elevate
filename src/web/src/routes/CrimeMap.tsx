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
  'Theft': '#f59e0b',
  'Assault': '#ef4444',
  'Robbery': '#dc2626',
  'Cyber Fraud': '#7c3aed',
  'Fraud': '#f97316',
  'Murder': '#991b1b',
  'Kidnapping': '#b91c1c',
  'POCSO': '#be185d',
  'Dowry Harassment': '#c2410c',
}

function getCategoryColor(cat: string): string {
  return CRIME_COLORS[cat] || '#3b82f6'
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
    return <div className="text-center py-20 text-gray-500">Select a station to view map.</div>
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading map…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>

  const categories = geoData
    ? [...new Set(geoData.spots.map((s) => s.crime_category))].sort()
    : []

  const { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } = MapComponents || {}

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">UP Crime Map</h1>
        <div className="flex gap-2 items-center">
          {/* Layer toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              className={`px-3 py-1.5 text-sm ${layerMode === 'spots' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              onClick={() => setLayerMode('spots')}
            >
              Spot Pins
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${layerMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              onClick={() => setLayerMode('heatmap')}
            >
              Heatmap
            </button>
          </div>
          {/* Category filter */}
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        {geoData?.spots.length ?? 0} FIRs plotted · {geoData?.heatmap.length ?? 0} heat points
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '580px' }}>
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
                      <span className="ml-1">
                        {spot.correlation.syndicate_flag ? ' 🚨' : ' 🔗'}
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
                          {spot.correlation.syndicate_flag && <span className="bg-red-100 text-red-700 px-1 rounded">🚨 SYNDICATE</span>}
                          <span className="text-gray-500">({Math.round(spot.correlation.confidence_score * 100)}%)</span>
                        </div>
                        {spot.correlation.primary_name && <div className="text-gray-600">{spot.correlation.primary_name}</div>}
                        {spot.correlation.reasoning_gloss && (
                          <p className="text-gray-700 italic border-l-2 border-blue-300 pl-1.5 mt-1">{spot.correlation.reasoning_gloss}</p>
                        )}
                        <ul className="mt-0.5 space-y-0.5">
                          {spot.correlation.match_reasons.map((r, i) => (
                            <li key={i} className="text-blue-700 bg-blue-50 rounded px-1 py-0.5">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => navigate(`/firs/${spot.fir_id}`)}
                      className="mt-1.5 w-full text-center bg-blue-600 hover:bg-blue-700 text-white rounded py-1"
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
                  fillColor: '#ef4444',
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
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading map components…
          </div>
        )}
      </div>
    </div>
  )
}
