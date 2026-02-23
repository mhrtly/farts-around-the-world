/**
 * GFMS API Client
 *
 * Typed fetch helpers for all REST endpoints.
 * Used by the submission form and can be used by any component
 * that needs to query the backend directly.
 */

export interface FartEvent {
  id: string
  lat: number
  lng: number
  intensity: number
  country: string
  timestamp: number
  type: 'standard' | 'epic' | 'silent-but-deadly'
}

export interface FartSubmission {
  lat: number
  lng: number
  intensity: number
  country: string
  type: FartEvent['type']
}

export interface GFMSStats {
  totalToday: number
  totalAllTime: number
  topCountry: string
  eventsByType: Record<string, number>
}

export interface HealthStatus {
  status: string
  uptime: number
  eventCount: number
}

const BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `API error: ${res.status}`)
  }
  return res.json()
}

export function submitFart(data: FartSubmission): Promise<FartEvent> {
  return request<FartEvent>('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function getRecentEvents(limit = 200): Promise<FartEvent[]> {
  return request<FartEvent[]>(`/api/events?limit=${limit}`)
}

export function getEventsByRange(start: number, end: number): Promise<FartEvent[]> {
  return request<FartEvent[]>(`/api/events/range?start=${start}&end=${end}`)
}

export function getStats(): Promise<GFMSStats> {
  return request<GFMSStats>('/api/stats')
}

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/api/health')
}
