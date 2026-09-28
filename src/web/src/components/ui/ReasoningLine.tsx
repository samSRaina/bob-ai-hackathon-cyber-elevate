interface Props {
  reasons: string[]
  gloss?: string | null
}

export default function ReasoningLine({ reasons, gloss }: Props) {
  return (
    <div className="space-y-2">
      {gloss && <p className="gloss">{gloss}</p>}
      <ul className="flex flex-wrap gap-1">
        {reasons.map((r, i) => (
          <li key={i} className="reason">
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}
