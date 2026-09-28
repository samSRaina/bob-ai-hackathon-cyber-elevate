import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  alert?: boolean
}

export default function Card({ children, className = '', alert = false }: Props) {
  return (
    <div className={`card ${alert ? 'card-alert' : ''} ${className}`}>
      {children}
    </div>
  )
}
