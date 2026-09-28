interface Props {
  label: string
  value: string | number
  sub?: string
}

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="stat">
      <p className="text-2xs font-medium tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-zinc-400">{sub}</p>}
    </div>
  )
}
