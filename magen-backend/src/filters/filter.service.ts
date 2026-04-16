import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type FilterToken = {
  address: string;
  symbol: string;
  holderCount: number;
  mentionCount1h: number;
};

type FilterSignalSnapshot = {
  txVelocityDelta: number;
  lpDepthUsd: number;
  tokenAgeHrs: number;
};

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);
  constructor(
    private readonly prisma: PrismaService,
  ) {}


  private readonly MIN_HOLDERS = 50;
  private readonly MIN_VELOCITY_DELTA = 0.8;
  private readonly MIN_MENTIONS_1H = 0;
  private readonly MIN_LP_DEPTH_USD = 2000;
  private readonly MAX_TOKEN_AGE_HOURS = 8; // Only consider very new tokens

  evaluateFilter(token: FilterToken, signal: FilterSignalSnapshot): { passes: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (token.holderCount < this.MIN_HOLDERS) {
      reasons.push(`Holder count too low (${token.holderCount} < ${this.MIN_HOLDERS})`);
    }
    if (signal.txVelocityDelta < this.MIN_VELOCITY_DELTA) {
      reasons.push(`Velocity too low (${signal.txVelocityDelta}x < ${this.MIN_VELOCITY_DELTA}x)`);
    }
    if (token.mentionCount1h < this.MIN_MENTIONS_1H) {
      reasons.push(`Mentions too low (${token.mentionCount1h} < ${this.MIN_MENTIONS_1H})`);
    }
    if (signal.lpDepthUsd < this.MIN_LP_DEPTH_USD) {
      reasons.push(`Liquidity too low ($${signal.lpDepthUsd} < $${this.MIN_LP_DEPTH_USD})`);
    }
    if (signal.tokenAgeHrs > this.MAX_TOKEN_AGE_HOURS) {
      reasons.push(`Token too old (${signal.tokenAgeHrs}h > ${this.MAX_TOKEN_AGE_HOURS}h)`);
    }

    const passes = reasons.length === 0;

    if (!passes) {
      this.logger.warn(`Filter failed for ${token.symbol || token.address}: ${reasons.join(', ')}`);
    } else {
      this.logger.log(`✅ Filter PASSED for ${token.symbol || token.address}`);
    }

    return { passes, reasons };
  }

  passesFilter(token: FilterToken, signal: FilterSignalSnapshot): boolean {
    return this.evaluateFilter(token, signal).passes;
  }
}