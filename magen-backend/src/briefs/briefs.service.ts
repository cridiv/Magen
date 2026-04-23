import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BriefsGateway } from './briefs.gateway';

type AgentLogQuery = {
  limit: number;
  tokenAddress?: string;
};

type AppendAgentLogInput = {
  tokenAddress?: string | null;
  eventType: string;
  message: string;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  timestamp?: string;
};

@Injectable()
export class BriefsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly briefsGateway: BriefsGateway,
  ) {}

  async findAll({ page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;

    const [briefs, total] = await Promise.all([
      this.prisma.memeBrief.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.memeBrief.count(),
    ]);

    return {
      data: briefs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findRecentAgentLogs({ limit, tokenAddress }: AgentLogQuery) {
    const logs = await this.prisma.pipelineLog.findMany({
      where: tokenAddress ? { tokenAddress } : undefined,
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        tokenAddress: true,
        eventType: true,
        message: true,
        timestamp: true,
      },
    });

    return logs.map((log) => ({
      tokenAddress: log.tokenAddress,
      eventType: log.eventType,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  async appendAgentLog(input: AppendAgentLogInput) {
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    const tokenAddress = input.tokenAddress ?? null;
    const metadata = input.metadata === null ? Prisma.JsonNull : input.metadata;

    await this.prisma.pipelineLog.create({
      data: {
        tokenAddress,
        eventType: input.eventType,
        message: input.message,
        metadata,
        timestamp,
      },
    });

    const payload = {
      tokenAddress,
      eventType: input.eventType,
      message: input.message,
      timestamp: timestamp.toISOString(),
    };

    this.briefsGateway.emitAgentLog(payload);
    return payload;
  }
}
