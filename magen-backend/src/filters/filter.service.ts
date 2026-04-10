import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Token, SignalSnapshot } from '@prisma/client';

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);
  constructor(
    private readonly prisma: PrismaService,
  ) {}


  private readonly MIN_HOLDERS = 120;
  private readonly MIN_VELOCITY_DELTA = 1.5;
  private readonly MIN_MENTIONS_1H = 25;
  private readonly MIN_LP_DEPTH_USD = 4500;
  private readonly MAX_TOKEN_AGE_HOURS = 8; // Only consider very new tokens

  passesFilter(token: Token, signal: SignalSnapshot): boolean {
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
      this.logger.debug(`Filter failed for ${token.symbol || token.address}: ${reasons.join(', ')}`);
    } else {
      this.logger.log(`✅ Filter PASSED for ${token.symbol || token.address}`);
    }

    return passes;
  }
}