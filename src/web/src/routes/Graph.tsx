import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RoleState } from '../App'
import { apiFetch } from '../api/client'
import { X } from 'lucide-react'

interface GraphNode {
  id: string
  type: string
  label: string
  cluster?: string
  crime_category?: string
  district?: string
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  edge_type: string
  reason?: string | null
  confidence?: number
  syndicate?: boolean
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

type Selection = { kind: 'node'; data: GraphNode } | { kind: 'link'; data: GraphLink }

export default function Graph({ rbac }: { rbac: RoleState }) {
  const navigate = useNavigate()
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selected, setSelected] = useState<Selection | null>(null)

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

      <div className="flex gap-3 items-start">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-1" style={{ height: '600px' }} ref={containerRef}>
          {ForceGraph && (
            <ForceGraph
              graphData={{ nodes: graphData.nodes, links: graphData.links }}
              nodeId="id"
              nodeLabel="label"
              nodeColor={nodeColor}
              linkColor={linkColor}
              linkWidth={(link: any) => link.edge_type === 'LINKED_TO' ? 2 : 1}
              linkDirectionalParticles={(link: any) => link.edge_type === 'LINKED_TO' ? 2 : 0}
              linkDirectionalParticleColor={(link: any) => link.syndicate ? '#ef4444' : '#3b82f6'}
              onNodeClick={(node: any) => setSelected({ kind: 'node', data: node })}
              onLinkClick={(link: any) => {
                if (link.edge_type === 'LINKED_TO') setSelected({ kind: 'link', data: link })
              }}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const label = node.label || ''
                const fontSize = Math.max(8, 12 / globalScale)
                ctx.font = `${fontSize}px Sans-Serif`
                const textWidth = ctx.measureText(label).width
                const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.4)
                const isSelected = selected?.kind === 'node' && selected.data.id === node.id
                ctx.fillStyle = nodeColor(node)
                ctx.beginPath()
                ctx.arc(node.x!, node.y!, isSelected ? 9 : 6, 0, 2 * Math.PI)
                ctx.fill()
                if (isSelected) {
                  ctx.strokeStyle = '#1f2328'
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }
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

        {/* Reasoning panel — every clustering relationship's evidence is shown here on click,
            for both a suspect/FIR node and a LINKED_TO edge between clustered suspects */}
        {selected && (
          <div className="w-72 shrink-0 bg-white rounded-lg border border-gray-200 p-4" style={{ height: '600px', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                {selected.kind === 'link' ? 'Match Reasoning' : 'Node Details'}
              </h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {selected.kind === 'node' && (
              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-800">{selected.data.label}</div>
                <div className="text-xs text-gray-500 uppercase">{selected.data.type}</div>
                {selected.data.crime_category && (
                  <div><span className="text-gray-400 text-xs">Category: </span>{selected.data.crime_category}</div>
                )}
                {selected.data.district && (
                  <div><span className="text-gray-400 text-xs">District: </span>{selected.data.district}</div>
                )}
                {selected.data.cluster && (
                  <div className="text-xs text-gray-400 break-all">Cluster: {selected.data.cluster}</div>
                )}
                {selected.data.type === 'fir' && (
                  <button
                    onClick={() => navigate(`/firs/${selected.data.id.replace('fir:', '')}`)}
                    className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1"
                  >
                    View FIR page
                  </button>
                )}
              </div>
            )}

            {selected.kind === 'link' && (
              <div className="space-y-2 text-sm">
                {selected.data.syndicate && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">🚨 Syndicate link</span>}
                {typeof selected.data.confidence === 'number' && (
                  <div className="text-xs text-gray-500">Confidence: <span className="font-mono text-gray-800">{Math.round(selected.data.confidence * 100)}%</span></div>
                )}
                <div className="text-xs font-semibold text-gray-500 uppercase mt-2">Why this is a match</div>
                <p className="text-sm text-gray-700 bg-blue-50 rounded p-2">
                  {selected.data.reason || 'No reasoning recorded for this link.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
