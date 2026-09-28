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
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <span className="font-bold text-lg tracking-tight">Bob Engine</span>
        <p className="text-xs text-gray-400 mt-0.5">FIR Intelligence</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 text-xs text-gray-500 border-t border-gray-700">
        Problem #10 · Track 4
      </div>
    </aside>
  )
}
