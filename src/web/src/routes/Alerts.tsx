import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'
import { AlertTriangle, Info, TrendingUp, RefreshCw, BellOff } from 'lucide-react'

interface Alert {
  id: number
  cluster_canonical_id: string
  triggering_fir_id: number | null
  triggering_fir_number: string | null
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

const POLL_INTERVAL_MS = 15000

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  // Backend timestamps come as "YYYY-MM-DD HH:MM:SS.ffffff+00:00" (already has an
  // explicit offset) — only append a Z when there's no timezone marker at all.
  const hasOffset = /[zZ]$|[+-]\d\d:\d\d$/.test(iso)
  const normalized = iso.replace(' ', 'T') + (hasOffset ? '' : 'Z')
  const then = new Date(normalized).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

export default function Alerts({ rbac }: { rbac: RoleState }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newIds, setNewIds] = useState<Set<number>>(new Set())
  const [, forceTick] = useState(0) // re-render periodically so "time ago" stays fresh
  const knownIds = useRef<Set<number> | null>(null)

  const fetchAlerts = useCallback((isBackground: boolean) => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    if (!isBackground) setLoading(true)
    apiFetch<{ alerts: Alert[] }>('/alerts', rbac.role, rbac.stationId)
      .then((d) => {
        const fresh = d.alerts || []
        if (knownIds.current) {
          const freshlyArrived = new Set(fresh.map((a) => a.id).filter((id) => !knownIds.current!.has(id)))
          if (freshlyArrived.size > 0) {
            setNewIds(freshlyArrived)
            setTimeout(() => setNewIds(new Set()), 6000)
          }
        }
        knownIds.current = new Set(fresh.map((a) => a.id))
        setAlerts(fresh)
        setLastUpdated(new Date())
        setError(null)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId])

  // Initial load + reload on scope change
  useEffect(() => {
    knownIds.current = null
    fetchAlerts(false)
  }, [fetchAlerts])

  // Live polling — dynamic, not a one-shot fetch
  useEffect(() => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) return
    const id = setInterval(() => fetchAlerts(true), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchAlerts, rbac.role, rbac.stationId])

  // Keep "time ago" labels fresh without a full refetch
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="state-empty">Select a station to view alerts.</div>
  }

  if (loading) return <div className="state-empty">Loading…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

  const isSyndicate = (a: Alert) => a.kind === 'became_syndicate' || a.message.includes('[SYNDICATE ALERT]')
  const counts = {
    new_cluster: alerts.filter((a) => a.kind === 'new_cluster' && !isSyndicate(a)).length,
    cluster_grew: alerts.filter((a) => a.kind === 'cluster_grew' && !isSyndicate(a)).length,
    became_syndicate: alerts.filter(isSyndicate).length,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="page-title">Alerts</h1>
        <Badge variant={alerts.some((a) => a.kind === 'became_syndicate') ? 'red' : 'default'}>
          {alerts.length} total
        </Badge>
        <span className="flex items-center gap-1.5 text-2xs text-emerald-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live · polling every {POLL_INTERVAL_MS / 1000}s
        </span>
        <button
          onClick={() => fetchAlerts(true)}
          className="icon-btn ml-auto"
          title="Refresh now"
        >
          <RefreshCw size={14} strokeWidth={1.75} />
        </button>
        {lastUpdated && (
          <span className="text-2xs tabular-nums text-zinc-400">Updated {timeAgo(lastUpdated.toISOString())}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="New Patterns" value={counts.new_cluster} />
        <StatCard label="Patterns Grew" value={counts.cluster_grew} />
        <StatCard label="Syndicate Alerts" value={counts.became_syndicate} sub={counts.became_syndicate > 0 ? 'needs attention' : undefined} />
      </div>

      {alerts.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <BellOff size={22} strokeWidth={1.5} className="text-zinc-300" />
            <p className="text-[13px] text-zinc-500">No alerts for this scope yet.</p>
            <p className="text-2xs text-zinc-400">New patterns and syndicate matches will appear here automatically.</p>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => {
          // A cluster that's already a syndicate the moment it's first detected
          // fires as kind="new_cluster" (there's no earlier "became" transition to
          // diff against) but the message still says [SYNDICATE ALERT] — badge by
          // that, not just the kind, so it's never mislabeled as a plain new pattern.
          const isSyndicateAlert = isSyndicate(alert)
          const config = isSyndicateAlert ? KIND_CONFIG.became_syndicate : (KIND_CONFIG[alert.kind] || KIND_CONFIG.new_cluster)
          const { Icon } = config
          const isNew = newIds.has(alert.id)
          return (
            <Card
              key={alert.id}
              alert={isSyndicateAlert}
              className={isNew ? 'ring-2 ring-accent/40 transition-shadow duration-1000' : 'transition-shadow duration-1000'}
            >
              <div className="flex items-start gap-3">
                <Icon
                  size={15}
                  strokeWidth={1.75}
                  className={
                    isSyndicateAlert ? 'mt-0.5 shrink-0 text-red-700' :
                    alert.kind === 'cluster_grew' ? 'mt-0.5 shrink-0 text-amber-700' :
                    'mt-0.5 shrink-0 text-zinc-500'
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={config.variant}>{config.label}</Badge>
                    {isNew && <Badge variant="green">new</Badge>}
                    <span className="text-2xs text-zinc-500">
                      {alert.scope_level}: {alert.scope_ref}
                    </span>
                    {alert.triggering_fir_number && alert.triggering_fir_id && (
                      <Link to={`/firs/${alert.triggering_fir_id}`} className="link text-2xs font-mono">
                        {alert.triggering_fir_number}
                      </Link>
                    )}
                    <span className="ml-auto text-2xs tabular-nums text-zinc-400" title={alert.created_at || ''}>
                      {timeAgo(alert.created_at)}
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
    </div>
  )
}
