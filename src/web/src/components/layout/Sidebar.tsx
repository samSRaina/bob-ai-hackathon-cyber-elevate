import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Network, Map, Bell } from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/firs', icon: FileText, label: 'FIRs' },
  { to: '/offenders', icon: Users, label: 'Patterns' },
  { to: '/graph', icon: Network, label: 'Graph' },
  { to: '/map', icon: Map, label: 'Crime Map' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" aria-hidden />
          <span className="text-[13px] font-semibold tracking-tight text-zinc-900">Bob Engine</span>
        </div>
        <p className="mt-1 pl-4 text-2xs text-zinc-500">FIR Intelligence</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                isActive
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 active:bg-zinc-100'
              }`
            }
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-zinc-200 px-4 py-3 text-2xs text-zinc-400">
        Problem #10 · Track 4
      </div>
    </aside>
  )
}
