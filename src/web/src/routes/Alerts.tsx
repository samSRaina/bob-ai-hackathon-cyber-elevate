import { useEffect, useState } from 'react'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'
import { AlertTriangle, Info, TrendingUp } from 'lucide-react'

interface Alert {
  id: number
  cluster_canonical_id: string
  triggering_fir_id: number | null
  kind: 'new_cluster' | 'cluster_grew' | 'became_syndicate'
  scope_level: string
  scope_ref: string
  message: string
  match_reasons: string[]
  created_at: string | null
}

const KIND_CONFIG = {
  new_cluster: { label: 'New Pattern', variant: 'default' as const, Icon: Info },
  cluster_grew: { label: 'Pattern Grew', variant: 'yellow' as const, Icon: TrendingUp },
  became_syndicate: { label: 'Syndicate', variant: 'red' as const, Icon: AlertTriangle },
}

export default function Alerts({ rbac }: { rbac: RoleState }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    setLoading(true)
    apiFetch<{ alerts: Alert[] }>('/alerts', rbac.role, rbac.stationId)
      .then((d) => setAlerts(d.alerts || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="text-center py-20 text-gray-500">Select a station to view alerts.</div>
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
        <Badge variant={alerts.some((a) => a.kind === 'became_syndicate') ? 'red' : 'default'}>
          {alerts.length} total
        </Badge>
      </div>

      {alerts.length === 0 && (
        <Card><p className="text-gray-400 text-sm">No alerts for this scope.</p></Card>
      )}

      {alerts.map((alert) => {
        const config = KIND_CONFIG[alert.kind] || KIND_CONFIG.new_cluster
        const { Icon } = config
        return (
          <Card
            key={alert.id}
            className={alert.kind === 'became_syndicate' ? 'border-red-300 bg-red-50' : ''}
          >
            <div className="flex items-start gap-3">
              <Icon
                size={18}
                className={
                  alert.kind === 'became_syndicate' ? 'text-red-500 mt-0.5 shrink-0' :
                  alert.kind === 'cluster_grew' ? 'text-yellow-500 mt-0.5 shrink-0' :
                  'text-blue-500 mt-0.5 shrink-0'
                }
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={config.variant}>{config.label}</Badge>
                  <span className="text-xs text-gray-500">
                    {alert.scope_level}: {alert.scope_ref}
                  </span>
                  {alert.triggering_fir_id && (
                    <a
                      href={`/firs/${alert.triggering_fir_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      FIR #{alert.triggering_fir_id}
                    </a>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {alert.created_at?.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mb-2">{alert.message}</p>
                <ReasoningLine reasons={alert.match_reasons} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
