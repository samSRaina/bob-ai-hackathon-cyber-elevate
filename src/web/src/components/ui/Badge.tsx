type Variant = 'default' | 'red' | 'yellow' | 'green' | 'purple'

const VARIANTS: Record<Variant, string> = {
  default: 'bg-gray-100 text-gray-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
}

interface Props {
  children: React.ReactNode
  variant?: Variant
}

export default function Badge({ children, variant = 'default' }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANTS[variant]}`}>
      {children}
    </span>
  )
}
