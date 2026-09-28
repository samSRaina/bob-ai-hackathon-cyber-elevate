import { useEffect, useState } from 'react'
import type { RoleState } from '../../App'

const ROLES = ['STATE_ADMIN', 'COMMISSIONER', 'CITY_POLICE', 'PI']

type Station = { id: number; name: string; city: string; district: string }

interface Props {
  rbac: RoleState
  setRbac: (r: RoleState) => void
}

export default function Topbar({ rbac, setRbac }: Props) {
  const [stations, setStations] = useState<Station[]>([])

  useEffect(() => {
    fetch('/api/stations/all', {
      headers: { 'X-User-Role': 'STATE_ADMIN' },
    })
      .then((r) => r.json())
      .then((d) => setStations(d.stations || []))
      .catch(() => {})
  }, [])

  const needsStation = rbac.role !== 'STATE_ADMIN'

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-6">
      <span className="text-2xs font-medium text-zinc-500">Viewing as</span>
      <select
        className="select-inline"
        value={rbac.role}
        onChange={(e) => setRbac({ role: e.target.value, stationId: rbac.stationId })}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace('_', ' ')}
          </option>
        ))}
      </select>
      {needsStation && (
        <select
          className="select-inline max-w-xs"
          value={rbac.stationId ?? ''}
          onChange={(e) => setRbac({ role: rbac.role, stationId: e.target.value || null })}
        >
          <option value="">Select station…</option>
          {stations.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name} ({s.city})
            </option>
          ))}
        </select>
      )}
      <div className="ml-auto text-2xs text-zinc-400">
        IBM Bob AI Hackathon · Problem #10
      </div>
    </header>
  )
}
