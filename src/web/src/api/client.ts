// Typed API client — expands with openapi-typescript generated types in Phase 8
const BASE_URL = '/api'

export function buildHeaders(role: string, stationId: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Role': role,
  }
  if (stationId) {
    headers['X-User-Station'] = stationId
  }
  return headers
}

export async function apiFetch<T>(
  path: string,
  role: string,
  stationId: string | null,
  params?: Record<string, string>
): Promise<T> {
  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, { headers: buildHeaders(role, stationId) })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}
