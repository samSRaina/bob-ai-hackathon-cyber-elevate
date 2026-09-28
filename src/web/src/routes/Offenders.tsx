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
    return <div className="state-empty">Select a station to view patterns.</div>
  }

  if (loading) return <div className="state-empty">Loading…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="page-title">Patterns & Offender Knowledge Base</h1>
          <p className="mt-0.5 text-2xs text-zinc-500">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''} detected</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-600">
          <input
            type="checkbox"
            checked={syndicateOnly}
            onChange={(e) => setSyndicateOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 accent-accent"
          />
          Syndicates only
        </label>
      </div>

      {clusters.length === 0 && (
        <Card><p className="text-[13px] text-zinc-500">No pattern clusters found for this scope.</p></Card>
      )}

      {clusters.map((c) => (
        <Card key={c.cluster_id} alert={c.syndicate_flag}>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
                  {c.primary_name || <span className="font-normal text-zinc-400">(unknown suspect)</span>}
                </span>
                {c.syndicate_flag && <Badge variant="red">Syndicate</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-zinc-500">
                <span>{c.linked_fir_ids.length} FIR{c.linked_fir_ids.length !== 1 ? 's' : ''}</span>
                <span>{c.linked_suspect_ids.length} suspect record{c.linked_suspect_ids.length !== 1 ? 's' : ''}</span>
                <span>Districts: {c.districts_involved.join(', ') || '—'}</span>
                <span>Cities: {c.cities_involved.join(', ') || '—'}</span>
              </div>
            </div>
            <div className="w-40 shrink-0">
              <p className="mb-1 text-2xs text-zinc-400">Confidence</p>
              <ConfidenceBar value={c.confidence_score} />
            </div>
          </div>

          <ReasoningLine reasons={c.match_reasons} gloss={c.reasoning_gloss} />

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-2xs text-zinc-500">Linked FIRs</span>
            {(c.linked_firs || []).map((lf) => (
              <Link
                key={lf.id}
                to={`/firs/${lf.id}`}
                className="chip-link font-mono"
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
