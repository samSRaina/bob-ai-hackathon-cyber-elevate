interface Props {
  value: number // 0–1
}

export default function ConfidenceBar({ value }: Props) {
  const pct = Math.round(value * 100)
  const color = value >= 0.9 ? 'bg-red-500' : value >= 0.7 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600">{pct}%</span>
    </div>
  )
}
