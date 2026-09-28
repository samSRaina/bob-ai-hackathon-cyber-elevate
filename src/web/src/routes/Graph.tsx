import { useEffect, useRef, useState } from 'react'
import type { RoleState } from '../App'
import { apiFetch } from '../api/client'

interface GraphData {
  nodes: Array<{
    id: string
    type: string
    label: string
    cluster?: string
    crime_category?: string
    district?: string
  }>
  links: Array<{
    source: string
    target: string
    edge_type: string
    confidence?: number
    syndicate?: boolean
  }>
}

export default function Graph({ rbac }: { rbac: RoleState }) {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)

  // Lazy-load react-force-graph-2d (browser only)
  useEffect(() => {
    import('react-force-graph-2d').then((mod) => {
      setForceGraph(() => mod.default)
    })
  }, [])

  useEffect(() => {
    if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) { setLoading(false); return }
    setLoading(true)
    apiFetch<GraphData>('/graph', rbac.role, rbac.stationId)
      .then(setGraphData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [rbac.role, rbac.stationId])

  if (rbac.role !== 'STATE_ADMIN' && !rbac.stationId) {
    return <div className="text-center py-20 text-gray-500">Select a station to view graph.</div>
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading graph…</div>
  if (error) return <div className="text-red-600 p-4 rounded bg-red-50">Error: {error}</div>
  if (!graphData) return null

  const nodeCount = graphData.nodes.length
  const edgeCount = graphData.links.length

  const nodeColor = (node: any) => {
    if (node.type === 'station') return '#6366f1'
    if (node.type === 'fir') return '#60a5fa'
    if (node.cluster) return '#f87171'  // clustered suspect
    return '#94a3b8'
  }

  const linkColor = (link: any) => {
    if (link.edge_type === 'LINKED_TO') return link.syndicate ? '#ef4444' : '#3b82f6'
    if (link.edge_type === 'IN_FIR') return '#e2e8f0'
    return '#d1d5db'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">Syndicate Graph</h1>
        <span className="text-sm text-gray-500">{nodeCount} nodes · {edgeCount} edges</span>
        <div className="flex gap-3 ml-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Suspect (clustered)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> FIR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" /> Station</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }} ref={containerRef}>
        {ForceGraph && (
          <ForceGraph
            graphData={{ nodes: graphData.nodes, links: graphData.links }}
            nodeId="id"
            nodeLabel="label"
            nodeColor={nodeColor}
            linkColor={linkColor}
            linkDirectionalParticles={(link: any) => link.edge_type === 'LINKED_TO' ? 2 : 0}
            linkDirectionalParticleColor={(link: any) => link.syndicate ? '#ef4444' : '#3b82f6'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label || ''
              const fontSize = Math.max(8, 12 / globalScale)
              ctx.font = `${fontSize}px Sans-Serif`
              const textWidth = ctx.measureText(label).width
              const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.4)
              ctx.fillStyle = nodeColor(node)
              ctx.beginPath()
              ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI)
              ctx.fill()
              if (globalScale > 0.5) {
                ctx.fillStyle = 'rgba(255,255,255,0.8)'
                ctx.fillRect(
                  node.x! - bckgDimensions[0] / 2,
                  node.y! + 8,
                  ...bckgDimensions as [number, number]
                )
                ctx.fillStyle = '#1f2328'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(label, node.x!, node.y! + 8 + bckgDimensions[1] / 2)
              }
            }}
            width={containerRef.current?.clientWidth || 900}
            height={600}
            backgroundColor="#f8fafc"
          />
        )}
      </div>
    </div>
  )
}
