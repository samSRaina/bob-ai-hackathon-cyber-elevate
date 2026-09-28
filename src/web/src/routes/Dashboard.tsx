import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'
import { AlertTriangle, TrendingUp, FileText, Users } from 'lucide-react'

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
  match_reasons: string[]
  reasoning_gloss: string | null
  linked_firs: LinkedFirBrief[]
}

interface Summary {
  total_firs: number
  total_clusters: number
  total_syndicates: number
  by_category: Record<string, number>
  by_station: Record<string, number>
  by_district: Record<string, number>
}

export default function Dashboard({ rbac }: { rbac: RoleState }) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const role = rbac.role
    const sid = rbac.stationId

    if (role !== 'STATE_ADMIN' && !sid) {
      setLoading(false)
      return
    }

    Promise.all([
      apiFetch<{ offenders: Cluster[] }>('/offenders', role, sid),
      apiFetch<Summary>('/dashboard/summary', role, sid),
    ])
      .then(([off, sum]) => {
        setClusters(off.offenders || [])
        setSummary(sum)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return (
      <div className="state-empty">
        Select a station from the top bar to view data.
      </div>
    )
  }

  if (loading) return <div className="state-empty">Loading…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

  const syndicates = clusters.filter((c) => c.syndicate_flag)
  const topCategories = summary
    ? Object.entries(summary.by_category).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []
  const topDistricts = summary
    ? Object.entries(summary.by_district).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h1 className="page-title">Pattern Correlations</h1>
          {syndicates.length > 0 && (
            <Badge variant="red">
              <AlertTriangle size={10} className="mr-1 inline" />
              {syndicates.length} Syndicate{syndicates.length > 1 ? 's' : ''}
            </Badge>
          )}
          <span className="page-meta">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''}</span>
        </div>

        {clusters.length === 0 ? (
          <Card>
            <p className="text-[13px] text-zinc-500">No pattern correlations found for this scope.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {clusters.map((c) => (
              <ClusterCard key={c.cluster_id} cluster={c} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Statistics — secondary panel                                        */}
      {/* ------------------------------------------------------------------ */}
      {summary && (
        <section>
          <h2 className="section-title mb-3">Statistics</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total FIRs" value={summary.total_firs} />
            <StatCard label="Pattern Clusters" value={summary.total_clusters} />
            <StatCard label="Syndicates" value={summary.total_syndicates} sub="cross-district" />
            <StatCard label="Districts" value={Object.keys(summary.by_district).length} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
                <TrendingUp size={14} strokeWidth={1.75} /> By Crime Category
              </h3>
              <div className="space-y-2">
                {topCategories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-[13px]">
                    <span className="text-zinc-700">{cat}</span>
                    <div className="flex items-center gap-2">
                      <div className="meter w-24">
                        <span
                          className="bg-accent"
                          style={{ width: `${(count / (summary.total_firs || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono text-2xs tabular-nums text-zinc-500">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-[13px] font-medium text-zinc-700">By District</h3>
              <div className="space-y-2">
                {topDistricts.map(([dist, count]) => (
                  <div key={dist} className="flex items-center justify-between text-[13px]">
                    <span className="text-zinc-700">{dist}</span>
                    <div className="flex items-center gap-2">
                      <div className="meter w-24">
                        <span
                          className="bg-zinc-400"
                          style={{ width: `${(count / (summary.total_firs || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono text-2xs tabular-nums text-zinc-500">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}

function ClusterCard({ cluster }: { cluster: Cluster }) {
  return (
    <Card alert={cluster.syndicate_flag}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-900">
              {cluster.primary_name || '(unknown suspect)'}
            </span>
            {cluster.syndicate_flag && <Badge variant="red">Syndicate</Badge>}
            <Badge variant="purple">{cluster.linked_fir_ids.length} FIRs</Badge>
          </div>
          <div className="mt-1 text-2xs text-zinc-500">
            Districts: {cluster.districts_involved.join(', ') || '—'}
            {cluster.cities_involved.length > 0 && ` · ${cluster.cities_involved.join(', ')}`}
          </div>
        </div>
        <div className="w-36 shrink-0">
          <ConfidenceBar value={cluster.confidence_score} />
        </div>
      </div>
      <ReasoningLine reasons={cluster.match_reasons} gloss={cluster.reasoning_gloss} />
      {(cluster.linked_firs || []).length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-2xs text-zinc-500">Linked FIRs</span>
          {(cluster.linked_firs || []).map((lf) => (
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
      )}
    </Card>
  )
}
