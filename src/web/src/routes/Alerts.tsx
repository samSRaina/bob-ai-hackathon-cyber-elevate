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
    return <div className="state-empty">Select a station to view alerts.</div>
  }

  if (loading) return <div className="state-empty">Loading…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="page-title">Alerts</h1>
        <Badge variant={alerts.some((a) => a.kind === 'became_syndicate') ? 'red' : 'default'}>
          {alerts.length} total
        </Badge>
      </div>

      {alerts.length === 0 && (
        <Card><p className="text-[13px] text-zinc-500">No alerts for this scope.</p></Card>
      )}

      {alerts.map((alert) => {
        const config = KIND_CONFIG[alert.kind] || KIND_CONFIG.new_cluster
        const { Icon } = config
        return (
          <Card
            key={alert.id}
            alert={alert.kind === 'became_syndicate'}
          >
            <div className="flex items-start gap-3">
              <Icon
                size={15}
                strokeWidth={1.75}
                className={
                  alert.kind === 'became_syndicate' ? 'mt-0.5 shrink-0 text-red-700' :
                  alert.kind === 'cluster_grew' ? 'mt-0.5 shrink-0 text-amber-700' :
                  'mt-0.5 shrink-0 text-zinc-500'
                }
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={config.variant}>{config.label}</Badge>
                  <span className="text-2xs text-zinc-500">
                    {alert.scope_level}: {alert.scope_ref}
                  </span>
                  {alert.triggering_fir_id && (
                    <a
                      href={`/firs/${alert.triggering_fir_id}`}
                      className="link text-2xs"
                    >
                      FIR #{alert.triggering_fir_id}
                    </a>
                  )}
                  <span className="ml-auto text-2xs tabular-nums text-zinc-400">
                    {alert.created_at?.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="mb-2 text-[13px] text-zinc-800">{alert.message}</p>
                <ReasoningLine reasons={alert.match_reasons} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
