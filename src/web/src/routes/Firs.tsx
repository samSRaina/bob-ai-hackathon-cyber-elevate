import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ReasoningLine from '../components/ui/ReasoningLine'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import { apiFetch } from '../api/client'
import { ChevronLeft, Search } from 'lucide-react'

interface FIR {
  id: number
  fir_number: string
  crime_category: string
  district: string
  police_station: string
  fir_date_time: string
  occurrence_address: string
  complainant_name: string
  narrative: string
  modus_operandi: string
  acts_sections: Array<{ act: string; section: string }>
  suspects: Suspect[]
  correlation: Correlation | null
  [key: string]: unknown
}

interface Suspect {
  id: number
  name: string | null
  alias: string | null
  sex: string | null
  dob_or_year: string | null
  build: string | null
  complexion: string | null
  identification_marks: string | null
  phone_numbers: string[]
  vehicle_numbers: string[]
  cluster_canonical_id: string | null
}

interface Correlation {
  cluster_id: string
  primary_name: string | null
  confidence_score: number
  syndicate_flag: boolean
  districts_involved: string[]
  linked_fir_ids: number[]
  match_reasons: string[]
  reasoning_gloss: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  'Theft': 'yellow',
  'Assault': 'red',
  'Robbery': 'red',
  'Cyber Fraud': 'purple',
  'Fraud': 'yellow',
  'Murder': 'red',
  'Kidnapping': 'red',
  'POCSO': 'red',
  'Dowry Harassment': 'yellow',
}

export default function Firs({ rbac }: { rbac: RoleState }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [firs, setFirs] = useState<FIR[]>([])
  const [selectedFir, setSelectedFir] = useState<FIR | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!rbac.role) return
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    setLoading(true)
    apiFetch<{ firs: FIR[] }>('/firs', rbac.role, rbac.stationId)
      .then((d) => setFirs(d.firs || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId])

  useEffect(() => {
    if (id) {
      apiFetch<FIR>(`/firs/${id}`, rbac.role, rbac.stationId)
        .then(setSelectedFir)
        .catch(() => {})
    } else {
      setSelectedFir(null)
    }
  }, [id, rbac.role, rbac.stationId])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="text-center py-20 text-gray-500">Select a station to view FIRs.</div>
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>

  // Detail view
  if (selectedFir) {
    return <FIRDetail fir={selectedFir} onBack={() => navigate('/firs')} />
  }

  const categories = [...new Set(firs.map((f) => f.crime_category))].sort()
  const filtered = firs.filter((f) => {
    const matchCat = !categoryFilter || f.crime_category === categoryFilter
    const matchSearch = !search ||
      f.fir_number.includes(search) ||
      (f.complainant_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.occurrence_address || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">FIRs <span className="text-gray-400 text-base font-normal">({filtered.length})</span></h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search FIRs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">FIR No.</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Station / District</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Linked?</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fir) => (
              <tr
                key={fir.id}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/firs/${fir.id}`)}
              >
                <td className="px-4 py-2.5 font-mono text-blue-600">{fir.fir_number}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={(CATEGORY_COLORS[fir.crime_category] as any) || 'default'}>
                    {fir.crime_category}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{fir.police_station}<span className="text-gray-400"> · {fir.district}</span></td>
                <td className="px-4 py-2.5 text-gray-500">{fir.fir_date_time?.slice(0, 10)}</td>
                <td className="px-4 py-2.5">
                  {fir.correlation ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${fir.correlation.syndicate_flag ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {fir.correlation.syndicate_flag ? '🚨 Syndicate' : '🔗 Linked'}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No FIRs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FIRDetail({ fir, onBack }: { fir: FIR; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
        <ChevronLeft size={14} /> Back to FIRs
      </button>

      {/* Correlation / Reasoning — shown FRONT AND CENTER */}
      {fir.correlation && (
        <Card className={fir.correlation.syndicate_flag ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-800">Pattern Match</span>
            {fir.correlation.syndicate_flag && <Badge variant="red">🚨 SYNDICATE</Badge>}
            <Badge variant="purple">{fir.correlation.linked_fir_ids.length} FIRs linked</Badge>
          </div>
          <div className="mb-2 w-40">
            <ConfidenceBar value={fir.correlation.confidence_score} />
          </div>
          <ReasoningLine reasons={fir.correlation.match_reasons} gloss={fir.correlation.reasoning_gloss} />
          <div className="mt-2 text-xs text-gray-500">
            Districts: {fir.correlation.districts_involved.join(', ')}
          </div>
        </Card>
      )}

      {/* FIR Header */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-bold">FIR {fir.fir_number}</h2>
          <Badge variant={(CATEGORY_COLORS[fir.crime_category] as any) || 'default'}>{fir.crime_category}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Field label="District" value={fir.district} />
          <Field label="Police Station" value={fir.police_station} />
          <Field label="FIR Date/Time" value={fir.fir_date_time?.replace('T', ' ').slice(0, 16)} />
          <Field label="Year" value={String(fir.year)} />
          <Field label="Information Type" value={fir.information_type as string} />
          <Field label="Action Taken" value={fir.action_taken as string} />
        </div>
      </Card>

      {/* Acts & Sections */}
      {(fir.acts_sections || []).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Acts & Sections</h3>
          <div className="flex flex-wrap gap-2">
            {(fir.acts_sections as Array<{ act: string; section: string }>).map((a, i) => (
              <Badge key={i} variant="default">{a.act} §{a.section}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Occurrence */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Occurrence of Offence</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Field label="Day" value={fir.occurrence_day as string} />
          <Field label="Date From" value={(fir.occurrence_date_from as string)?.slice(0, 10)} />
          <Field label="Time Period" value={fir.occurrence_time_period as string} />
          <Field label="Time" value={`${fir.occurrence_time_from || ''} – ${fir.occurrence_time_to || ''}`} />
          <Field label="Address" value={fir.occurrence_address as string} span={2} />
          <Field label="Direction from PS" value={fir.direction_distance_from_ps as string} />
          <Field label="Beat No." value={fir.beat_no as string} />
        </div>
      </Card>

      {/* Complainant */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Complainant</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Field label="Name" value={fir.complainant_name as string} />
          <Field label="Relative Name" value={fir.complainant_relative_name as string} />
          <Field label="DOB/Year" value={fir.complainant_dob_or_year as string} />
          <Field label="Occupation" value={fir.complainant_occupation as string} />
          <Field label="Mobile" value={fir.complainant_mobile as string} />
          <Field label="Phone" value={fir.complainant_phone as string} />
        </div>
      </Card>

      {/* Accused / Suspects */}
      {(fir.suspects || []).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Accused ({fir.suspects.length})
          </h3>
          {fir.suspects.map((s, i) => (
            <div key={s.id} className={`${i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}`}>
              <div className="font-medium text-gray-800 mb-1">
                {s.name || <span className="italic text-gray-400">Name unknown</span>}
                {s.alias && <span className="text-gray-400 text-sm ml-2">alias: {s.alias}</span>}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <Field label="Sex" value={s.sex} />
                <Field label="DOB/Year" value={s.dob_or_year} />
                <Field label="Build" value={s.build} />
                <Field label="Complexion" value={s.complexion} />
                <Field label="Marks" value={s.identification_marks} />
              </div>
              {(s.phone_numbers.length > 0 || s.vehicle_numbers.length > 0) && (
                <div className="mt-1 flex gap-3 text-xs">
                  {s.phone_numbers.map((p) => (
                    <Badge key={p} variant="green">📞 {p}</Badge>
                  ))}
                  {s.vehicle_numbers.map((v) => (
                    <Badge key={v} variant="yellow">🚗 {v}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Properties */}
      {(fir.properties as any[])?.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Properties of Interest</h3>
          <div className="space-y-1">
            {(fir.properties as any[]).map((p, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <Badge variant="default">{p.property_category}</Badge>
                <span className="text-gray-700">{p.description}</span>
                {p.value_rupees > 0 && <span className="text-gray-500 ml-auto">₹{p.value_rupees.toLocaleString()}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Narrative */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">First Information Contents</h3>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{fir.narrative}</p>
        {fir.modus_operandi && (
          <div className="mt-3 p-2 bg-gray-50 rounded border-l-2 border-blue-300">
            <span className="text-xs font-semibold text-gray-500 uppercase">Modus Operandi: </span>
            <span className="text-sm text-gray-700">{fir.modus_operandi}</span>
          </div>
        )}
      </Card>

      {/* IO / Action */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Action Taken</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Field label="Action" value={fir.action_taken as string} />
          <Field label="IO Name" value={fir.investigating_officer_name as string} />
          <Field label="IO Rank" value={fir.investigating_officer_rank as string} />
          <Field label="IO Number" value={fir.investigating_officer_number as string} />
        </div>
      </Card>
    </div>
  )
}

function Field({ label, value, span }: { label: string; value?: string | null; span?: number }) {
  if (!value) return null
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <span className="text-gray-400 text-xs">{label}: </span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
