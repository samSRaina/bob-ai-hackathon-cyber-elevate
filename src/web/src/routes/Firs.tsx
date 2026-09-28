import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ReasoningLine from '../components/ui/ReasoningLine'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import { apiFetch } from '../api/client'
import { ChevronLeft, Search, X, ExternalLink } from 'lucide-react'

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

interface LinkedFirBrief {
  id: number
  fir_number: string
  crime_category: string
  district: string
  police_station: string
  fir_date_time: string | null
  complainant_name: string | null
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
  linked_firs: LinkedFirBrief[]
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
    return <div className="state-empty">Select a station to view FIRs.</div>
  }

  if (loading) return <div className="state-empty">Loading…</div>
  if (error) return <div className="banner-error">Error: {error}</div>

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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="page-title">FIRs <span className="page-meta">({filtered.length})</span></h1>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="input pl-8"
              placeholder="Search FIRs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select-inline"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => navigate('/firs/new')}
            className="btn btn-primary"
          >
            Add FIR
          </button>
        </div>
      </div>

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>FIR No.</th>
              <th>Category</th>
              <th>Station / District</th>
              <th>Date</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fir) => (
              <tr
                key={fir.id}
                tabIndex={0}
                onClick={() => navigate(`/firs/${fir.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/firs/${fir.id}`)
                  }
                }}
              >
                <td className="font-mono text-[12px] text-zinc-900">{fir.fir_number}</td>
                <td>
                  <Badge variant={(CATEGORY_COLORS[fir.crime_category] as any) || 'default'}>
                    {fir.crime_category}
                  </Badge>
                </td>
                <td className="text-zinc-600">{fir.police_station}<span className="text-zinc-400"> · {fir.district}</span></td>
                <td className="tabular-nums text-zinc-500">{fir.fir_date_time?.slice(0, 10)}</td>
                <td>
                  {fir.correlation ? (
                    <Badge variant={fir.correlation.syndicate_flag ? 'red' : 'default'}>
                      {fir.correlation.syndicate_flag ? 'Syndicate' : 'Linked'}
                    </Badge>
                  ) : (
                    <span className="text-2xs text-zinc-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="is-empty"><td colSpan={5} className="py-8 text-center text-zinc-400">No FIRs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FIRDetail({ fir, onBack }: { fir: FIR; onBack: () => void }) {
  const navigate = useNavigate()
  const [popupFir, setPopupFir] = useState<LinkedFirBrief | null>(null)

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="link">
        <ChevronLeft size={14} /> Back to FIRs
      </button>

      {fir.correlation && (
        <Card alert={fir.correlation.syndicate_flag}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-900">Pattern Match</span>
            {fir.correlation.syndicate_flag && <Badge variant="red">Syndicate</Badge>}
            <Badge variant="purple">{(fir.correlation.linked_fir_ids || []).length} FIRs linked</Badge>
          </div>
          <div className="mb-2 w-40">
            <ConfidenceBar value={fir.correlation.confidence_score} />
          </div>
          <ReasoningLine reasons={fir.correlation.match_reasons || []} gloss={fir.correlation.reasoning_gloss} />
          <div className="mt-2 text-2xs text-zinc-500">
            Districts: {(fir.correlation.districts_involved || []).join(', ')}
          </div>

          {(fir.correlation.linked_firs || []).length > 0 && (
            <div className="mt-3 border-t border-zinc-100 pt-3">
              <div className="mb-1.5 text-2xs font-medium text-zinc-500">
                Related FIRs ({(fir.correlation.linked_firs || []).length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(fir.correlation.linked_firs || []).map((lf) => (
                  <button
                    key={lf.id}
                    onClick={() => setPopupFir(lf)}
                    className="chip-link"
                  >
                    <span className="font-mono text-zinc-900">{lf.fir_number}</span>
                    <span className="text-zinc-500">{lf.crime_category}</span>
                    <span className="text-zinc-400">· {lf.district}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {popupFir && (
        <LinkedFirPopup
          fir={popupFir}
          onClose={() => setPopupFir(null)}
          onGoToFir={() => { setPopupFir(null); navigate(`/firs/${popupFir.id}`) }}
        />
      )}

      {/* FIR Header */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-mono text-[15px] font-semibold tracking-tight text-zinc-900">FIR {fir.fir_number}</h2>
          <Badge variant={(CATEGORY_COLORS[fir.crime_category] as any) || 'default'}>{fir.crime_category}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
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
          <h3 className="section-title mb-2">Acts & Sections</h3>
          <div className="flex flex-wrap gap-2">
            {(fir.acts_sections as Array<{ act: string; section: string }>).map((a, i) => (
              <Badge key={i} variant="default">{a.act} §{a.section}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Occurrence */}
      <Card>
        <h3 className="section-title mb-3">Occurrence of Offence</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
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
        <h3 className="section-title mb-3">Complainant</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
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
          <h3 className="section-title mb-3">
            Accused ({fir.suspects.length})
          </h3>
          {fir.suspects.map((s, i) => (
            <div key={s.id} className={`${i > 0 ? 'mt-3 border-t border-zinc-100 pt-3' : ''}`}>
              <div className="mb-2 text-[13px] font-medium text-zinc-900">
                {s.name || <span className="text-zinc-400">Name unknown</span>}
                {s.alias && <span className="ml-2 text-[12px] font-normal text-zinc-400">alias {s.alias}</span>}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
                <Field label="Sex" value={s.sex} />
                <Field label="DOB/Year" value={s.dob_or_year} />
                <Field label="Build" value={s.build} />
                <Field label="Complexion" value={s.complexion} />
                <Field label="Marks" value={s.identification_marks} />
              </div>
              {(s.phone_numbers.length > 0 || s.vehicle_numbers.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.phone_numbers.map((p) => (
                    <Badge key={p} variant="green">Phone {p}</Badge>
                  ))}
                  {s.vehicle_numbers.map((v) => (
                    <Badge key={v} variant="yellow">Plate {v}</Badge>
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
          <h3 className="section-title mb-2">Properties of Interest</h3>
          <div className="space-y-2">
            {(fir.properties as any[]).map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px]">
                <Badge variant="default">{p.property_category}</Badge>
                <span className="text-zinc-700">{p.description}</span>
                {p.value_rupees > 0 && <span className="ml-auto tabular-nums text-zinc-500">₹{p.value_rupees.toLocaleString()}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Narrative */}
      <Card>
        <h3 className="section-title mb-2">First Information Contents</h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{fir.narrative}</p>
        {fir.modus_operandi && (
          <div className="mt-3 border-l border-zinc-300 bg-zinc-50 px-3 py-2">
            <span className="text-2xs font-medium text-zinc-500">Modus operandi </span>
            <span className="text-[13px] text-zinc-700">{fir.modus_operandi}</span>
          </div>
        )}
      </Card>

      {/* IO / Action */}
      <Card>
        <h3 className="section-title mb-3">Action Taken</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
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
      <div className="text-2xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-[13px] text-zinc-900">{value}</div>
    </div>
  )
}

function LinkedFirPopup({ fir, onClose, onGoToFir }: { fir: LinkedFirBrief; onClose: () => void; onGoToFir: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-mono text-[13px] font-semibold text-zinc-900">{fir.fir_number}</h3>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mb-4 space-y-2 text-[13px]">
          <div className="flex items-center gap-2"><span className="text-2xs text-zinc-500">Category</span><Badge variant="default">{fir.crime_category}</Badge></div>
          <Field label="District" value={fir.district} />
          <Field label="Police Station" value={fir.police_station} />
          <Field label="Date" value={fir.fir_date_time?.replace('T', ' ').slice(0, 16)} />
          <Field label="Complainant" value={fir.complainant_name} />
        </div>
        <button
          onClick={onGoToFir}
          className="btn btn-primary w-full"
        >
          Go to FIR page <ExternalLink size={14} />
        </button>
      </div>
    </div>
  )
}
