import { AgentLog, BriefsResponse, MemeBrief } from './types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'

export async function fetchBriefs(page = 1, limit = 20): Promise<BriefsResponse> {
  const res = await fetch(`${API}/briefs?page=${page}&limit=${limit}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch briefs')
  return res.json()
}

export async function fetchRecentBriefs(limit = 50): Promise<MemeBrief[]> {
  const res = await fetchBriefs(1, limit)
  return res.data
}

export async function fetchRecentAgentLogs(limit = 40): Promise<AgentLog[]> {
  const res = await fetch(`${API}/briefs/logs?limit=${limit}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch agent logs')
  return res.json()
}