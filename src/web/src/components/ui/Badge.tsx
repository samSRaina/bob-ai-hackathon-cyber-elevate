type Variant = 'default' | 'red' | 'yellow' | 'green' | 'purple'

const VARIANTS: Record<Variant, string> = {
  default: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  purple: 'bg-zinc-50 text-zinc-700 ring-zinc-300',
}

interface Props {
  children: React.ReactNode
  variant?: Variant
}

export default function Badge({ children, variant = 'default' }: Props) {
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${VARIANTS[variant]}`}>
      {children}
    </span>
  )
}
