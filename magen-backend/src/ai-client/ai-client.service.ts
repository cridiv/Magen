import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassifyRequest {
  token: {
    address: string
    name: string
    symbol: string
    holderCount: number
    mentionCount1h: number
    accountAgeDistribution: {
      under7Days: number
      under30Days: number
      over30Days: number
    }
  }
  signal: {
    txVelocityDelta: number
    buyPressureRatio: number
    top10Concentration: number
    holderGrowthRate: number
    lpDepthUsd: number
    tokenAgeHrs: number
  }
}

export interface ClassifyResponse {
  worth_debating: boolean
  cultural_archetype: string
  bot_suspicion_score: number
  irony_signal: boolean
  reasoning: string
}

export interface DebateRequest {
  token: ClassifyRequest['token']
  signal: ClassifyRequest['signal']
  classifier: ClassifyResponse
}

export interface DebateResponse {
  optimist: string
  skeptic: string
  synthesis: string
  verdict_tag: string
  confidence_signal: string
  cultural_archetype: string
}

export interface AiErrorResponse {
  error: string
  message: string
  retryable: boolean
  retry_after_ms?: number
}

// ─── Result wrappers ──────────────────────────────────────────────────────────

type AiResult<T> =
  | { success: true; data: T }
  | { success: false; reason: string; retryable: boolean }

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name)
  private readonly client: AxiosInstance

  private readonly MAX_RETRIES = Number(process.env.AI_MAX_RETRIES ?? 3)
  private readonly BASE_DELAY_MS = Number(process.env.AI_RETRY_BASE_DELAY_MS ?? 1000)

  constructor() {
    this.client = axios.create({
      baseURL: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      timeout: Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 60_000),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── Public methods ──────────────────────────────────────────────────────

  async classify(payload: ClassifyRequest): Promise<AiResult<ClassifyResponse>> {
    return this.callWithRetry<ClassifyResponse>('/classify', payload)
  }

  async debate(payload: DebateRequest): Promise<AiResult<DebateResponse>> {
    return this.callWithRetry<DebateResponse>('/debate', payload)
  }

  // ─── Core retry loop ─────────────────────────────────────────────────────

  private async callWithRetry<T>(
    route: string,
    payload: unknown,
    attempt = 1,
  ): Promise<AiResult<T>> {
    try {
      const { data } = await this.client.post<T>(route, payload)

      // Validate the response is a non-null object
      if (!data || typeof data !== 'object') {
        this.logger.warn(`${route} returned non-object response — skipping token`)
        return { success: false, reason: 'malformed_response', retryable: false }
      }

      // FastAPI can return structured errors with HTTP 200; treat those as failures.
      const bodyError = this.toAiErrorResponse(data)
      if (bodyError) {
        const waitMs = bodyError.retry_after_ms ?? this.BASE_DELAY_MS * attempt
        this.logger.warn(
          `${route} returned logical error: ${bodyError.error} (retryable=${bodyError.retryable})`,
        )

        if (bodyError.retryable && attempt < this.MAX_RETRIES) {
          await this.delay(waitMs)
          return this.callWithRetry<T>(route, payload, attempt + 1)
        }

        return {
          success: false,
          reason: bodyError.error ?? 'logical_error',
          retryable: bodyError.retryable,
        }
      }

      // Route-specific schema checks to avoid propagating undefined fields.
      if (route === '/classify' && !this.isClassifyResponse(data)) {
        this.logger.error(`${route} returned malformed classifier payload`)
        return { success: false, reason: 'malformed_classify_response', retryable: false }
      }

      if (route === '/debate' && !this.isDebateResponse(data)) {
        this.logger.error(`${route} returned malformed debate payload`)
        return { success: false, reason: 'malformed_debate_response', retryable: false }
      }

      return { success: true, data }

    } catch (err) {
      return this.handleError<T>(err, route, payload, attempt)
    }
  }

  // ─── Error handler ────────────────────────────────────────────────────────

  private async handleError<T>(
    err: unknown,
    route: string,
    payload: unknown,
    attempt: number,
  ): Promise<AiResult<T>> {

    // Python service is down / unreachable
    if (axios.isAxiosError(err) && !err.response) {
      this.logger.error(
        `AI service unreachable on ${route} (attempt ${attempt}) — ${err.message}`,
      )
      if (attempt < this.MAX_RETRIES) {
        await this.delay(this.BASE_DELAY_MS * attempt)
        return this.callWithRetry<T>(route, payload, attempt + 1)
      }
      return { success: false, reason: 'service_unreachable', retryable: false }
    }

    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status
      const body = err.response.data as Partial<AiErrorResponse>

      // Python returned a structured error with retryable flag
      if (body?.retryable === true) {
        const waitMs = body.retry_after_ms ?? this.BASE_DELAY_MS * attempt
        this.logger.warn(
          `${route} retryable error: ${body.error} — waiting ${waitMs}ms (attempt ${attempt})`,
        )
        if (attempt < this.MAX_RETRIES) {
          await this.delay(waitMs)
          return this.callWithRetry<T>(route, payload, attempt + 1)
        }
        return { success: false, reason: body.error ?? 'retryable_exhausted', retryable: false }
      }

      // 5xx — retry with backoff
      if (status >= 500) {
        this.logger.warn(`${route} returned ${status} (attempt ${attempt})`)
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.BASE_DELAY_MS * attempt)
          return this.callWithRetry<T>(route, payload, attempt + 1)
        }
        return { success: false, reason: `http_${status}`, retryable: false }
      }

      // 4xx — don't retry, bad request
      this.logger.error(`${route} returned ${status} — bad request, skipping token`)
      return { success: false, reason: `http_${status}`, retryable: false }
    }

    // JSON parse error from axios (malformed response body)
    if (err instanceof SyntaxError) {
      this.logger.error(`${route} returned malformed JSON — skipping token`)
      return { success: false, reason: 'malformed_json', retryable: false }
    }

    // Unknown error
    this.logger.error(`${route} unknown error: ${String(err)}`)
    return { success: false, reason: 'unknown', retryable: false }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isClassifyResponse(data: unknown): data is ClassifyResponse {
    if (!data || typeof data !== 'object') return false

    const d = data as Record<string, unknown>
    return (
      typeof d.worth_debating === 'boolean' &&
      typeof d.cultural_archetype === 'string' &&
      typeof d.bot_suspicion_score === 'number' &&
      typeof d.irony_signal === 'boolean' &&
      typeof d.reasoning === 'string'
    )
  }

  private isDebateResponse(data: unknown): data is DebateResponse {
    if (!data || typeof data !== 'object') return false

    const d = data as Record<string, unknown>
    return (
      typeof d.optimist === 'string' &&
      typeof d.skeptic === 'string' &&
      typeof d.synthesis === 'string' &&
      typeof d.verdict_tag === 'string' &&
      typeof d.confidence_signal === 'string' &&
      typeof d.cultural_archetype === 'string'
    )
  }

  private toAiErrorResponse(data: unknown): AiErrorResponse | null {
    if (!data || typeof data !== 'object') return null

    const d = data as Record<string, unknown>
    if (
      typeof d.error === 'string' &&
      typeof d.message === 'string' &&
      typeof d.retryable === 'boolean'
    ) {
      return {
        error: d.error,
        message: d.message,
        retryable: d.retryable,
        retry_after_ms:
          typeof d.retry_after_ms === 'number' ? d.retry_after_ms : undefined,
      }
    }

    return null
  }
}