import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBatchDto, IngestTokenItemDto } from './dto/ingest.dto';
import { FilterService } from '../filters/filter.service';

type IngestResult = {
  tokenAddress: string;
  symbol: string;
  passesFilter: boolean;
};

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: FilterService,
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
        const passesFilter = this.filterService.passesFilter(token, signal);

        await this.prisma.pipelineLog.create({
          data: {
            tokenAddress: item.address,
            eventType: passesFilter ? 'filter_pass' : 'filter_fail',
            message: `Filter ${passesFilter ? 'passed' : 'failed'}`,
            metadata: { passesFilter, holderCount: token.holderCount },
          },
        });

        results.push({
          tokenAddress: item.address,
          symbol: item.symbol,
          passesFilter,
        });

        this.logger.log(`Ingested token ${item.symbol} (${item.address}) | Filter: ${passesFilter}`);
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
