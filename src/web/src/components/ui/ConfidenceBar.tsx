interface Props {
  value: number // 0–1
}

export default function ConfidenceBar({ value }: Props) {
  const pct = Math.round(value * 100)
  const color = value >= 0.9 ? 'bg-red-700' : value >= 0.7 ? 'bg-amber-700' : 'bg-accent'
  return (
    <div className="flex items-center gap-2">
      <div className="meter flex-1">
        <span className={color} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs font-medium tabular-nums text-zinc-500">{pct}%</span>
    </div>
  )
}
