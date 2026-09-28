interface Props {
  reasons: string[]
  gloss?: string | null
}

export default function ReasoningLine({ reasons, gloss }: Props) {
  return (
    <div className="space-y-1">
      {gloss && (
        <p className="text-sm text-gray-800 italic border-l-2 border-blue-400 pl-2">{gloss}</p>
      )}
      <ul className="flex flex-wrap gap-1">
        {reasons.map((r, i) => (
          <li key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}
