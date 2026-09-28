import { useEffect, useState } from 'react'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'
import { AlertTriangle, TrendingUp, FileText, Users } from 'lucide-react'

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
      <div className="text-center py-20 text-gray-500">
        Select a station from the top bar to view data.
      </div>
    )
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>

  const syndicates = clusters.filter((c) => c.syndicate_flag)
  const topCategories = summary
    ? Object.entries(summary.by_category).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []
  const topDistricts = summary
    ? Object.entries(summary.by_district).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Pattern Correlations — PRIMARY panel (first & largest)             */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900">Pattern Correlations</h1>
          {syndicates.length > 0 && (
            <Badge variant="red">
              <AlertTriangle size={10} className="mr-1 inline" />
              {syndicates.length} Syndicate{syndicates.length > 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-sm text-gray-400 ml-1">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''}</span>
        </div>

        {clusters.length === 0 ? (
          <Card>
            <p className="text-gray-400 text-sm">No pattern correlations found for this scope.</p>
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total FIRs" value={summary.total_firs} />
            <StatCard label="Pattern Clusters" value={summary.total_clusters} />
            <StatCard label="Syndicates" value={summary.total_syndicates} sub="cross-district" />
            <StatCard label="Districts" value={Object.keys(summary.by_district).length} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                <TrendingUp size={14} /> By Crime Category
              </h3>
              <div className="space-y-2">
                {topCategories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{cat}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(count / (summary.total_firs || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-500 font-mono text-xs w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">By District</h3>
              <div className="space-y-2">
                {topDistricts.map(([dist, count]) => (
                  <div key={dist} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{dist}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${(count / (summary.total_firs || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-500 font-mono text-xs w-6 text-right">{count}</span>
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
    <Card className={cluster.syndicate_flag ? 'border-red-300 bg-red-50' : ''}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">
              {cluster.primary_name || '(unknown suspect)'}
            </span>
            {cluster.syndicate_flag && <Badge variant="red">🚨 SYNDICATE</Badge>}
            <Badge variant="purple">{cluster.linked_fir_ids.length} FIRs</Badge>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Districts: {cluster.districts_involved.join(', ') || '—'}
            {cluster.cities_involved.length > 0 && ` · ${cluster.cities_involved.join(', ')}`}
          </div>
        </div>
        <div className="w-36 shrink-0">
          <ConfidenceBar value={cluster.confidence_score} />
        </div>
      </div>
      <ReasoningLine reasons={cluster.match_reasons} gloss={cluster.reasoning_gloss} />
    </Card>
  )
}
