import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBatchDto, IngestTokenItemDto } from './dto/ingest.dto';
import { FilterService } from '../filters/filter.service';
import { DebateService, ProcessTokenResult } from '../debates/debate.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: FilterService,
    private readonly debateService: DebateService,
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

    for (const item of items) {
      try {
        const token = await this.prisma.token.upsert({
          where: { address: item.address },
          update: {
            name: item.name,
            symbol: item.symbol,
            holderCount: item.holderCount,
            mentionCount1h: item.mentionCount1h,
          },
          create: {
            address: item.address,
            name: item.name,
            symbol: item.symbol,
            holderCount: item.holderCount,
            mentionCount1h: item.mentionCount1h,
          },
        });

        const signal = await this.prisma.signalSnapshot.create({
          data: {
            tokenAddress: item.address,
            txVelocityDelta: item.signal.txVelocityDelta,
            buyPressureRatio: item.signal.buyPressureRatio,
            top10Concentration: item.signal.top10Concentration,
            holderGrowthRate: item.signal.holderGrowthRate,
            lpDepthUsd: item.signal.lpDepthUsd,
            tokenAgeHrs: item.signal.tokenAgeHrs,
          },
        });

        // Automatically run filter
        const filter = this.filterService.evaluateFilter(token, signal);
        const passesFilter = filter.passes;
        let aiResult: ProcessTokenResult | null = null;

        if (passesFilter || this.forceAiPipeline) {
          if (!passesFilter && this.forceAiPipeline) {
            this.logger.warn(
              `FORCE_AI_PIPELINE=true -> bypassing filter for ${item.symbol} (${item.address})`,
            );
          }
          aiResult = await this.debateService.processToken(token, signal);
        }

        await this.prisma.pipelineLog.create({
          data: {
            tokenAddress: item.address,
            eventType: passesFilter ? 'filter_pass' : 'filter_fail',
            message: `Filter ${passesFilter ? 'passed' : 'failed'}`,
            metadata: { passesFilter, reasons: filter.reasons, holderCount: token.holderCount },
          },
        });

        results.push({
          tokenAddress: item.address,
          symbol: item.symbol,
          passesFilter,
          filterReasons: filter.reasons,
          aiResult,
        });

        this.logger.log(
          `Ingested token ${item.symbol} (${item.address}) | Filter: ${passesFilter}` +
            (this.forceAiPipeline && !passesFilter ? ' | AI: forced' : '') +
            (aiResult
              ? ` | AI: ${aiResult.briefCreated ? 'brief_created' : aiResult.worthDebating ? 'debated' : 'classified_only'}`
              : ''),
        );
      } catch (error) {
        this.logger.error(`Failed to ingest token ${item.address}`, error);
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  }
}
