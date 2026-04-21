export interface MemeBrief {
  id: string
  tokenAddress: string
  createdAt: string
  culturalArchetype: string
  verdictTag: string
  confidenceSignal: string
  synthesis: string
  optimist: string
  skeptic: string
  postedToTelegram: boolean
  telegramMessageId?: string | null
  token?: {
    name?: string
    symbol?: string
    holderCount?: number
    mentionCount1h?: number
  }
}

export interface PipelineError {
  tokenAddress: string
  reason: string
}

export interface BriefsResponse {
  data: MemeBrief[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type ConnectionStatus = 'connecting' | 'live' | 'replay' | 'disconnected'