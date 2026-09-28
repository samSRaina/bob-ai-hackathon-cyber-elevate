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
    return <div className="state-empty">Select a station to view graph.</div>
  }

  if (loading) return <div className="state-empty">Loading graph…</div>
  if (error) return <div className="banner-error">Error: {error}</div>
  if (!graphData) return null

  const nodeCount = graphData.nodes.length
  const edgeCount = graphData.links.length

  const nodeColor = (node: any) => {
    if (node.type === 'station') return '#71717a'
    if (node.type === 'fir') return '#3e4c59'
    if (node.cluster) return '#9f1239'
    return '#a1a1aa'
  }

  const linkColor = (link: any) => {
    if (link.edge_type === 'LINKED_TO') return link.syndicate ? '#9f1239' : '#3e4c59'
    if (link.edge_type === 'IN_FIR') return '#e4e4e7'
    return '#d4d4d8'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="page-title">Syndicate Graph</h1>
        <span className="page-meta">{nodeCount} nodes · {edgeCount} edges</span>
        <div className="flex gap-3 text-2xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-rose-800" /> Suspect</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-accent" /> FIR</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-zinc-500" /> Station</span>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 overflow-hidden rounded-md border border-zinc-200 bg-white" style={{ height: '600px' }} ref={containerRef}>
          {ForceGraph && (
            <ForceGraph
              graphData={{ nodes: graphData.nodes, links: graphData.links }}
              nodeId="id"
              nodeLabel="label"
              nodeColor={nodeColor}
              linkColor={linkColor}
              linkWidth={(link: any) => link.edge_type === 'LINKED_TO' ? 2 : 1}
              linkDirectionalParticles={(link: any) => link.edge_type === 'LINKED_TO' ? 2 : 0}
              linkDirectionalParticleColor={(link: any) => link.syndicate ? '#9f1239' : '#3e4c59'}
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
              backgroundColor="#fafafa"
            />
          )}
        </div>

        {/* Reasoning panel — every clustering relationship's evidence is shown here on click,
            for both a suspect/FIR node and a LINKED_TO edge between clustered suspects */}
        {selected && (
          <div className="w-72 shrink-0 overflow-y-auto rounded-md border border-zinc-200 bg-white p-4" style={{ height: '600px' }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-zinc-900">
                {selected.kind === 'link' ? 'Match Reasoning' : 'Node Details'}
              </h3>
              <button onClick={() => setSelected(null)} className="icon-btn" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {selected.kind === 'node' && (
              <div className="space-y-2 text-[13px]">
                <div className="font-medium text-zinc-900">{selected.data.label}</div>
                <div className="text-2xs text-zinc-500">{selected.data.type}</div>
                {selected.data.crime_category && (
                  <div><span className="text-2xs text-zinc-400">Category </span>{selected.data.crime_category}</div>
                )}
                {selected.data.district && (
                  <div><span className="text-2xs text-zinc-400">District </span>{selected.data.district}</div>
                )}
                {selected.data.cluster && (
                  <div className="break-all text-2xs text-zinc-400">Cluster {selected.data.cluster}</div>
                )}
                {selected.data.type === 'fir' && (
                  <button
                    onClick={() => navigate(`/firs/${selected.data.id.replace('fir:', '')}`)}
                    className="btn btn-primary mt-2"
                  >
                    View FIR page
                  </button>
                )}
              </div>
            )}

            {selected.kind === 'link' && (
              <div className="space-y-2 text-[13px]">
                {selected.data.syndicate && <span className="inline-flex rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800 ring-1 ring-inset ring-red-200">Syndicate link</span>}
                {typeof selected.data.confidence === 'number' && (
                  <div className="text-2xs text-zinc-500">Confidence <span className="font-mono tabular-nums text-zinc-800">{Math.round(selected.data.confidence * 100)}%</span></div>
                )}
                <div className="mt-2 text-2xs font-medium text-zinc-500">Why this is a match</div>
                <p className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[13px] text-zinc-700">
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
