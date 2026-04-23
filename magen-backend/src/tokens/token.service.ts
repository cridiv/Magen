import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBatchDto, IngestTokenItemDto } from './dto/ingest.dto';
import { FilterService } from '../filters/filter.service';
import { DebateService, ProcessTokenResult } from '../debates/debate.service';
import { BriefsGateway } from '../briefs/briefs.gateway';

type IngestResult = {
  tokenAddress: string;
  symbol: string;
  passesFilter: boolean;
  filterReasons?: string[];
  aiResult?: ProcessTokenResult | null;
};

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly forceAiPipeline = process.env.FORCE_AI_PIPELINE === 'true';

  private readonly transientDbErrorCodes = new Set(['P1001', 'P2024']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: FilterService,
    private readonly debateService: DebateService,
    private readonly briefsGateway: BriefsGateway,
  ) {}

  async ingestTokens(dto: IngestBatchDto) {
    const items: IngestTokenItemDto[] = [];

    // Handle single token fallback
    if (dto.address && dto.signal) {
      items.push({
        address: dto.address,
        name: dto.name!,
        symbol: dto.symbol!,
        holderCount: dto.holderCount!,
        mentionCount1h: dto.mentionCount1h!,
        signal: dto.signal,
      });
    }
    // Handle batch
    else if (dto.tokens && dto.tokens.length > 0) {
      items.push(...dto.tokens);
    } else {
      throw new Error('Invalid payload: no tokens provided');
    }

    const results: IngestResult[] = [];
    this.logger.debug(
      `Raw payload sample: ${JSON.stringify(dto.tokens?.[0]?.signal)}`,
    );

    for (const item of items) {
      try {
        await this.upsertToken(item);

        const filterInput = {
          address: item.address,
          symbol: item.symbol,
          holderCount: item.holderCount,
          mentionCount1h: item.mentionCount1h,
        };

        const signalInput = {
          txVelocityDelta: item.signal.txVelocityDelta,
          lpDepthUsd: item.signal.lpDepthUsd,
          tokenAgeHrs: item.signal.tokenAgeHrs,
        };

        // Automatically run filter
        const filter = this.filterService.evaluateFilter(
          filterInput,
          signalInput,
        );
        const passesFilter = filter.passes;
        let aiResult: ProcessTokenResult | null = null;

        if (passesFilter || this.forceAiPipeline) {
          if (!passesFilter && this.forceAiPipeline) {
            this.logger.warn(
              `FORCE_AI_PIPELINE=true -> bypassing filter for ${item.symbol} (${item.address})`,
            );
          }
          aiResult = await this.debateService.processToken(
            filterInput,
            signalInput,
          );
        }

        await this.safePipelineLog({
          data: {
            tokenAddress: item.address,
            eventType: passesFilter ? 'filter_pass' : 'filter_fail',
            message: passesFilter
              ? `Filter PASSED for ${item.symbol}`
              : `Filter failed for ${item.symbol}: ${filter.reasons.join(', ')}`,
            metadata: {
              passesFilter,
              symbol: item.symbol,
              reasons: filter.reasons,
              holderCount: filterInput.holderCount,
              lpDepthUsd: signalInput.lpDepthUsd,
            },
          },
        });

        results.push({
          tokenAddress: item.address,
          symbol: item.symbol,
          passesFilter,
          filterReasons: filter.reasons,
          aiResult,
        });

        const ingestMessage =
          `Ingested token ${item.symbol} (${item.address}) | Filter: ${passesFilter}` +
          (this.forceAiPipeline && !passesFilter ? ' | AI: forced' : '') +
          (aiResult
            ? ` | AI: ${aiResult.briefCreated ? 'brief_created' : aiResult.worthDebating ? 'debated' : 'classified_only'}`
            : '');

        this.logger.log(ingestMessage);
        await this.safePipelineLog({
          data: {
            tokenAddress: item.address,
            eventType: 'ingest_processed',
            message: ingestMessage,
            metadata: {
              symbol: item.symbol,
              passesFilter,
              forced: this.forceAiPipeline && !passesFilter,
              aiOutcome: aiResult
                ? aiResult.briefCreated
                  ? 'brief_created'
                  : aiResult.worthDebating
                    ? 'debated'
                    : 'classified_only'
                : null,
            },
          },
        });
      } catch (error) {
        this.logger.error(`Failed to ingest token ${item.address}`, error);
        await this.safePipelineLog({
          data: {
            tokenAddress: item.address,
            eventType: 'ingest_error',
            message: 'Token ingestion failed',
            metadata: {
              symbol: item.symbol,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  }

  private async upsertToken(item: IngestTokenItemDto): Promise<void> {
    await this.prisma.token.upsert({
      where: { address: item.address },
      create: {
        address: item.address,
        name: item.name,
        symbol: item.symbol,
        holderCount: item.holderCount,
        mentionCount1h: item.mentionCount1h,
      },
      update: {
        name: item.name,
        symbol: item.symbol,
        holderCount: item.holderCount,
        mentionCount1h: item.mentionCount1h,
      },
    });
  }

  private async safePipelineLog(
    args: Parameters<PrismaService['pipelineLog']['create']>[0],
  ): Promise<void> {
    try {
      await this.prisma.pipelineLog.create(args);

      const data = args.data as {
        tokenAddress?: string | null;
        eventType?: string;
        message?: string;
      };

      if (
        typeof data.eventType === 'string' &&
        typeof data.message === 'string'
      ) {
        this.briefsGateway.emitAgentLog({
          tokenAddress: data.tokenAddress ?? null,
          eventType: data.eventType,
          message: data.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : undefined;

      if (code && this.transientDbErrorCodes.has(code)) {
        this.logger.warn(
          `Skipping pipeline log write due to transient DB error (${code})`,
        );
        return;
      }

      this.logger.error('Failed to write pipeline log', error);
    }
  }
}
