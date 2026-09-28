import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './routes/Dashboard'
import Firs from './routes/Firs'
import AddFir from './routes/AddFir'
import Offenders from './routes/Offenders'
import Graph from './routes/Graph'
import CrimeMap from './routes/CrimeMap'
import Alerts from './routes/Alerts'
import { useState } from 'react'

export type RoleState = {
  role: string
  stationId: string | null
}

export const DEFAULT_ROLE: RoleState = { role: 'STATE_ADMIN', stationId: null }

export default function App() {
  const [rbac, setRbac] = useState<RoleState>(DEFAULT_ROLE)

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar rbac={rbac} setRbac={setRbac} />
          <main className="min-h-0 flex-1 overflow-auto px-6 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard rbac={rbac} />} />
              <Route path="/firs" element={<Firs rbac={rbac} />} />
              <Route path="/firs/new" element={<AddFir rbac={rbac} />} />
              <Route path="/firs/:id" element={<Firs rbac={rbac} />} />
              <Route path="/offenders" element={<Offenders rbac={rbac} />} />
              <Route path="/graph" element={<Graph rbac={rbac} />} />
              <Route path="/map" element={<CrimeMap rbac={rbac} />} />
              <Route path="/alerts" element={<Alerts rbac={rbac} />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
