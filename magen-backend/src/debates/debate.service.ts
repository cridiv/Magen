import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiClientService, ClassifyRequest } from '../ai-client/ai-client.service'
import { BriefsGateway } from '../briefs/briefs.gateway'
import { Token, SignalSnapshot } from '@prisma/client'

@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name)

  // Cooldown tracking — tokenAddress → last brief timestamp
  private readonly cooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 15 * 60 * 1000 ;// 15 minutes

  // Suppression memory — tokenAddress → consecutive high bot_suspicion count
  private readonly botSuspicionCounts = new Map<string, number>();
  private readonly BOT_SUSPICION_THRESHOLD = 0.8;
  private readonly SUPPRESSION_COUNT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClientService,
    private readonly briefsGateway: BriefsGateway,
  ) {}

  // ─── Entry point — called by FilterService after a token passes ───────────

  async processToken(token: Token, signal: SignalSnapshot): Promise<void> {
    const address = token.address

    // Check cooldown
    if (this.isOnCooldown(address)) {
      this.logger.debug(`${token.symbol} is on cooldown — skipping`)
      return
    }

    // Check suppression memory
    if (this.isSuppressed(address)) {
      this.logger.warn(`${token.symbol} suppressed — high bot suspicion on 3+ consecutive calls`)
      return
    }

    // Build classify payload
    const classifyPayload: ClassifyRequest = {
      token: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        holderCount: token.holderCount,
        mentionCount1h: token.mentionCount1h,
        accountAgeDistribution: {
          under7Days: 0.55,
          under30Days: 0.3,
          over30Days: 0.15,
        },
      },
      signal: {
        txVelocityDelta: signal.txVelocityDelta,
        buyPressureRatio: signal.buyPressureRatio,
        top10Concentration: signal.top10Concentration,
        holderGrowthRate: signal.holderGrowthRate,
        lpDepthUsd: signal.lpDepthUsd,
        tokenAgeHrs: signal.tokenAgeHrs,
      },
    }

    // ── Step 1: Classify ────────────────────────────────────────────────────
    this.logger.log(`Classifying ${token.symbol}...`)
    const classifyResult = await this.aiClient.classify(classifyPayload)

    if (!classifyResult.success) {
      this.logger.warn(`Classify failed for ${token.symbol}: ${classifyResult.reason}`)
      await this.logPipeline(token.address, 'classify_failed', classifyResult.reason)
      return
    }

    const classifier = classifyResult.data

    // Save classifier output
    await this.prisma.classifierOutput.create({
      data: {
        tokenAddress: token.address,
        worthDebatING: classifier.worth_debating,
        culturalArchetype: classifier.cultural_archetype,
        botSuspicionScore: classifier.bot_suspicion_score,
        ironySignal: classifier.irony_signal,
        reasoning: classifier.reasoning,
      },
    })

    // Update suppression memory
    this.updateBotSuspicion(address, classifier.bot_suspicion_score)

    // If not worth debating, stop here
    if (!classifier.worth_debating) {
      this.logger.log(`${token.symbol} not worth debating — skipping debate`)
      await this.logPipeline(token.address, 'skipped_debate', 'worth_debating: false')
      return
    }

    // ── Step 2: Debate ──────────────────────────────────────────────────────
    this.logger.log(`Debating ${token.symbol}...`)
    const debateResult = await this.aiClient.debate({
      token: classifyPayload.token,
      signal: classifyPayload.signal,
      classifier,
    })

    if (!debateResult.success) {
      this.logger.warn(`Debate failed for ${token.symbol}: ${debateResult.reason}`)
      await this.logPipeline(token.address, 'debate_failed', debateResult.reason)
      return
    }

    const debate = debateResult.data

    // ── Step 3: Save MemeBrief ──────────────────────────────────────────────
    const synthesis = debate.synthesis?.trim()
      ? debate.synthesis
      : 'Synthesis unavailable — debate data preserved.'

    const brief = await this.prisma.memeBrief.create({
      data: {
        tokenAddress: token.address,
        optimist: debate.optimist,
        skeptic: debate.skeptic,
        synthesis,
        verdictTag: debate.verdict_tag,
        confidenceSignal: debate.confidence_signal,
        culturalArchetype: debate.cultural_archetype,
      },
    })

    // ── Step 4: Set cooldown ────────────────────────────────────────────────
    this.cooldowns.set(address, Date.now())

    // ── Step 5: Emit via WebSocket ──────────────────────────────────────────
    this.briefsGateway.emitBrief(brief)

    this.logger.log(`Brief created and emitted for ${token.symbol} — "${debate.verdict_tag}"`)
    await this.logPipeline(token.address, 'brief_created', debate.verdict_tag)
  }

  // ─── Cooldown ─────────────────────────────────────────────────────────────

  private isOnCooldown(address: string): boolean {
    const last = this.cooldowns.get(address)
    if (!last) return false
    return Date.now() - last < this.COOLDOWN_MS
  }

  // ─── Suppression memory ───────────────────────────────────────────────────

  private updateBotSuspicion(address: string, score: number): void {
    if (score >= this.BOT_SUSPICION_THRESHOLD) {
      const current = this.botSuspicionCounts.get(address) ?? 0
      this.botSuspicionCounts.set(address, current + 1)
    } else {
      // Reset on a clean call
      this.botSuspicionCounts.set(address, 0)
    }
  }

  private isSuppressed(address: string): boolean {
    return (this.botSuspicionCounts.get(address) ?? 0) >= this.SUPPRESSION_COUNT
  }

  // ─── Pipeline log ─────────────────────────────────────────────────────────

  private async logPipeline(
    tokenAddress: string,
    event: string,
    detail: string,
  ): Promise<void> {
    await this.prisma.pipelineLog.create({
      data: {
        tokenAddress,
        eventType: event,
        message: detail,
        metadata: { event, detail },
      },
    }).catch(err => {
      this.logger.error(`Failed to write pipeline log: ${err}`)
    })
  }
}