import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'

interface LinkedFirBrief {
  id: number
  fir_number: string
  crime_category: string
  district: string
  police_station: string
  fir_date_time: string | null
  complainant_name: string | null
}

interface Cluster {
  cluster_id: string
  primary_name: string | null
  confidence_score: number
  syndicate_flag: boolean
  districts_involved: string[]
  cities_involved: string[]
  linked_fir_ids: number[]
  linked_suspect_ids: number[]
  match_reasons: string[]
  reasoning_gloss: string | null
  updated_at: string | null
  linked_firs: LinkedFirBrief[]
}

export default function Offenders({ rbac }: { rbac: RoleState }) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syndicateOnly, setSyndicateOnly] = useState(false)

  useEffect(() => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    setLoading(true)
    const params: Record<string, string> | undefined = syndicateOnly ? { syndicate_only: 'true' } : undefined
    apiFetch<{ offenders: Cluster[] }>('/offenders', rbac.role, rbac.stationId, params)
      .then((d) => setClusters(d.offenders || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId, syndicateOnly])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="text-center py-20 text-gray-500">Select a station to view patterns.</div>
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patterns & Offender Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''} detected</p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={syndicateOnly}
            onChange={(e) => setSyndicateOnly(e.target.checked)}
            className="rounded"
          />
          Syndicates only
        </label>
      </div>

      {clusters.length === 0 && (
        <Card><p className="text-gray-400 text-sm">No pattern clusters found for this scope.</p></Card>
      )}

      {clusters.map((c) => (
        <Card key={c.cluster_id} className={c.syndicate_flag ? 'border-red-300' : ''}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-lg text-gray-900">
                  {c.primary_name || <span className="italic text-gray-400">(unknown suspect)</span>}
                </span>
                {c.syndicate_flag && <Badge variant="red">🚨 SYNDICATE</Badge>}
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{c.linked_fir_ids.length} FIR{c.linked_fir_ids.length !== 1 ? 's' : ''}</span>
                <span>{c.linked_suspect_ids.length} suspect record{c.linked_suspect_ids.length !== 1 ? 's' : ''}</span>
                <span>Districts: {c.districts_involved.join(', ') || '—'}</span>
                <span>Cities: {c.cities_involved.join(', ') || '—'}</span>
              </div>
            </div>
            <div className="w-40 shrink-0">
              <p className="text-xs text-gray-400 mb-1">Confidence</p>
              <ConfidenceBar value={c.confidence_score} />
            </div>
          </div>

          {/* Reasoning gloss + match_reasons — always shown */}
          <ReasoningLine reasons={c.match_reasons} gloss={c.reasoning_gloss} />

          {/* Linked FIRs — shown by their human-readable FIR number, same as the FIRs list */}
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-1">Linked FIRs:</span>
            {(c.linked_firs || []).map((lf) => (
              <Link
                key={lf.id}
                to={`/firs/${lf.id}`}
                className="text-xs font-mono bg-gray-100 hover:bg-blue-50 text-blue-700 px-2 py-0.5 rounded transition-colors"
                title={`${lf.crime_category} · ${lf.district}`}
              >
                {lf.fir_number}
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
