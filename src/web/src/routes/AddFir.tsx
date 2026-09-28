import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RoleState } from '../App'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ConfidenceBar from '../components/ui/ConfidenceBar'
import ReasoningLine from '../components/ui/ReasoningLine'
import { apiFetch } from '../api/client'
import { ChevronLeft, Plus, Trash2, Sparkles } from 'lucide-react'

interface Station {
  id: number
  name: string
  city: string
  district: string
}

interface SuspectDraft {
  name: string
  alias: string
  phone: string
  vehicle: string
}

interface SimilarMatch {
  id: number
  fir_number: string
  crime_category: string
  district: string
  police_station: string
  fir_date_time: string | null
  complainant_name: string | null
  confidence: number
  match_reasons: string[]
  reasoning_gloss: string | null
}

const CRIME_CATEGORIES = [
  'Theft', 'Assault', 'Robbery', 'Kidnapping', 'Fraud',
  'Murder', 'POCSO', 'Dowry Harassment', 'Cyber Fraud',
]

// Deliberately reuses the seeded syndicate's own phone/vehicle/MO text, so
// submitting the form as-is immediately demonstrates the live similarity
// check and the FIR joining an existing pattern — no typing required to test.
function sampleDraft() {
  return {
    crimeCategory: 'Cyber Fraud',
    firDateTime: new Date().toISOString().slice(0, 16),
    occurrenceAddress: '12, MG Road, Lucknow',
    complainantName: 'Test Complainant',
    complainantPhone: '9812345670',
    narrative: 'Complainant states that on the aforementioned date and time, they received a phone call from an unknown number. Offender telephoned victim as bank official, cited pending KYC, obtained OTP and withdrew money using UPI payment gateway.',
    modusOperandi: 'Offender telephoned victim as bank official, cited pending KYC, obtained OTP and withdrew money using UPI payment gateway.',
    suspects: [
      { name: 'Ramesh Kumar', alias: 'RK', phone: '9911223344', vehicle: 'UP32AB1234' },
    ] as SuspectDraft[],
  }
}

export default function AddFir({ rbac }: { rbac: RoleState }) {
  const navigate = useNavigate()
  const [stations, setStations] = useState<Station[]>([])
  const [stationId, setStationId] = useState<number | ''>('')
  const [form, setForm] = useState(sampleDraft())
  const [matches, setMatches] = useState<SimilarMatch[]>([])
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    apiFetch<{ stations: Station[] }>('/stations/all', rbac.role, rbac.stationId)
      .then((d) => {
        setStations(d.stations || [])
        if (d.stations?.length) setStationId(d.stations[0].id)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live similarity check — debounced, fires as the officer fills in the
  // fields most likely to reveal a pattern (MO text, suspect identifiers).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const hasSignal = form.modusOperandi.trim() || form.suspects.some((s) => s.name || s.phone || s.vehicle)
    if (!hasSignal) { setMatches([]); return }

    debounceRef.current = setTimeout(async () => {
      setChecking(true)
      try {
        const data = await apiFetch<{ matches: SimilarMatch[] }>(
          '/firs/check-similarity', rbac.role, rbac.stationId, undefined,
          {
            method: 'POST',
            body: JSON.stringify({
              crime_category: form.crimeCategory,
              modus_operandi: form.modusOperandi,
              suspects: form.suspects
                .filter((s) => s.name || s.phone || s.vehicle)
                .map((s) => ({
                  name: s.name || null,
                  alias: s.alias || null,
                  phone_numbers: s.phone ? [s.phone] : [],
                  vehicle_numbers: s.vehicle ? [s.vehicle] : [],
                })),
            }),
          }
        )
        setMatches(data.matches || [])
      } catch {
        // Live-check is best-effort — a failure here shouldn't block filling the form
      } finally {
        setChecking(false)
      }
    }, 600)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.modusOperandi, form.crimeCategory, JSON.stringify(form.suspects)])

  const updateSuspect = (i: number, field: keyof SuspectDraft, value: string) => {
    setForm((f) => ({
      ...f,
      suspects: f.suspects.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    }))
  }

  const addSuspect = () => {
    setForm((f) => ({ ...f, suspects: [...f.suspects, { name: '', alias: '', phone: '', vehicle: '' }] }))
  }

  const removeSuspect = (i: number) => {
    setForm((f) => ({ ...f, suspects: f.suspects.filter((_, idx) => idx !== i) }))
  }

  const canSubmit = useMemo(() => stationId !== '' && form.crimeCategory && form.firDateTime, [stationId, form])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const fir = await apiFetch<{ id: number }>('/firs', rbac.role, rbac.stationId, undefined, {
        method: 'POST',
        body: JSON.stringify({
          station_id: stationId,
          crime_category: form.crimeCategory,
          fir_date_time: new Date(form.firDateTime).toISOString(),
          occurrence_address: form.occurrenceAddress || null,
          complainant_name: form.complainantName || null,
          complainant_phone: form.complainantPhone || null,
          narrative: form.narrative || null,
          modus_operandi: form.modusOperandi,
          suspects: form.suspects
            .filter((s) => s.name || s.phone || s.vehicle)
            .map((s) => ({
              name: s.name || null,
              alias: s.alias || null,
              phone_numbers: s.phone ? [s.phone] : [],
              vehicle_numbers: s.vehicle ? [s.vehicle] : [],
            })),
        }),
      })
      navigate(`/firs/${fir.id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="state-empty">Select a station to add a FIR.</div>
  }

  return (
    <div className="max-w-5xl space-y-4">
      <button onClick={() => navigate('/firs')} className="link">
        <ChevronLeft size={14} /> Back to FIRs
      </button>

      <div className="flex items-center justify-between">
        <h1 className="page-title">Add FIR</h1>
        <button
          onClick={() => setForm(sampleDraft())}
          className="btn btn-secondary"
        >
          <Sparkles size={13} /> Fill sample data
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="section-title mb-3">FIR Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Police Station">
                <select
                  className="input"
                  value={stationId}
                  onChange={(e) => setStationId(Number(e.target.value))}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {s.district}</option>
                  ))}
                </select>
              </Field>
              <Field label="Crime Category">
                <select
                  className="input"
                  value={form.crimeCategory}
                  onChange={(e) => setForm((f) => ({ ...f, crimeCategory: e.target.value }))}
                >
                  {CRIME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="FIR Date/Time">
                <input
                  type="datetime-local"
                  className="input"
                  value={form.firDateTime}
                  onChange={(e) => setForm((f) => ({ ...f, firDateTime: e.target.value }))}
                />
              </Field>
              <Field label="Occurrence Address">
                <input
                  className="input"
                  value={form.occurrenceAddress}
                  onChange={(e) => setForm((f) => ({ ...f, occurrenceAddress: e.target.value }))}
                />
              </Field>
              <Field label="Complainant Name">
                <input
                  className="input"
                  value={form.complainantName}
                  onChange={(e) => setForm((f) => ({ ...f, complainantName: e.target.value }))}
                />
              </Field>
              <Field label="Complainant Phone">
                <input
                  className="input"
                  value={form.complainantPhone}
                  onChange={(e) => setForm((f) => ({ ...f, complainantPhone: e.target.value }))}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <h3 className="section-title mb-3">First Information Contents</h3>
            <Field label="Narrative">
              <textarea
                className="input"
                rows={3}
                value={form.narrative}
                onChange={(e) => setForm((f) => ({ ...f, narrative: e.target.value }))}
              />
            </Field>
            <div className="mt-3">
              <Field label="Modus Operandi (drives similarity matching)">
                <textarea
                  className="input"
                  rows={3}
                  value={form.modusOperandi}
                  onChange={(e) => setForm((f) => ({ ...f, modusOperandi: e.target.value }))}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title">Accused / Suspects</h3>
              <button onClick={addSuspect} className="btn btn-ghost">
                <Plus size={13} /> Add suspect
              </button>
            </div>
            {form.suspects.length === 0 && (
              <p className="text-2xs text-zinc-400">No suspects added. This FIR will be recorded with an unknown accused.</p>
            )}
            <div className="space-y-3">
              {form.suspects.map((s, i) => (
                <div key={i} className="grid grid-cols-5 items-start gap-2 border-b border-zinc-100 pb-3 last:border-0">
                  <input className="input col-span-1" placeholder="Name" value={s.name} onChange={(e) => updateSuspect(i, 'name', e.target.value)} />
                  <input className="input col-span-1" placeholder="Alias" value={s.alias} onChange={(e) => updateSuspect(i, 'alias', e.target.value)} />
                  <input className="input col-span-1" placeholder="Phone" value={s.phone} onChange={(e) => updateSuspect(i, 'phone', e.target.value)} />
                  <input className="input col-span-1" placeholder="Vehicle no." value={s.vehicle} onChange={(e) => updateSuspect(i, 'vehicle', e.target.value)} />
                  <button onClick={() => removeSuspect(i)} className="icon-btn-danger mt-1 justify-self-center" aria-label="Remove suspect">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {error && <div className="banner-error">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn btn-primary w-full py-2.5"
          >
            {submitting ? 'Saving & running pattern detection…' : 'Submit FIR'}
          </button>
        </div>

        {/* Live similarity panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="section-title">Suggested Similar FIRs</h3>
              {checking && <span className="text-2xs text-zinc-400">Checking…</span>}
            </div>
            <p className="mb-3 text-2xs leading-4 text-zinc-500">
              Updates as you fill in the modus operandi and suspect details, before you submit.
            </p>

            {matches.length === 0 && !checking && (
              <p className="text-2xs text-zinc-400">No similar FIRs found yet.</p>
            )}

            <div className="max-h-[600px] space-y-2 overflow-y-auto">
              {matches.map((m) => (
                <div key={m.id} className="rounded-md border border-zinc-200 p-2.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] text-zinc-900">{m.fir_number}</span>
                    <Badge variant="default">{m.crime_category}</Badge>
                  </div>
                  <div className="mb-1.5 text-2xs text-zinc-500">
                    {m.police_station} · {m.district}
                    {m.complainant_name && ` · ${m.complainant_name}`}
                  </div>
                  <div className="mb-1.5 w-28">
                    <ConfidenceBar value={m.confidence} />
                  </div>
                  <ReasoningLine reasons={m.match_reasons} gloss={m.reasoning_gloss} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-2xs text-zinc-500">
      <span>{label}</span>
      {children}
    </label>
  )
}
