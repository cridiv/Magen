import { Injectable, Logger } from '@nestjs/common';

type FilterInput = {
  holderCount: number;
  mentionCount1h: number;
  symbol?: string;
  address?: string;
};

type SignalInput = {
  txVelocityDelta: number;
  lpDepthUsd: number;
  tokenAgeHrs: number;
};

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);

  private readonly MIN_HOLDERS = 20;
  private readonly MIN_MENTIONS_1H = 0;
  private readonly MIN_LP_DEPTH_USD = 4500;
  private readonly MIN_VELOCITY = 0.6;
  private readonly MAX_AGE_HOURS = 10;

  evaluateFilter(token: FilterInput, signal: SignalInput): { passes: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (token.holderCount < this.MIN_HOLDERS) {
      reasons.push(`Holder count too low (${token.holderCount} < ${this.MIN_HOLDERS})`);
    }
    if (token.mentionCount1h < this.MIN_MENTIONS_1H) {
      reasons.push(`Mentions too low (${token.mentionCount1h} < ${this.MIN_MENTIONS_1H})`);
    }
    if (signal.lpDepthUsd < this.MIN_LP_DEPTH_USD) {
      reasons.push(`Liquidity too low ($${Math.round(signal.lpDepthUsd)} < $${this.MIN_LP_DEPTH_USD})`);
    }
    if (signal.txVelocityDelta < this.MIN_VELOCITY) {
      reasons.push(`Velocity too low (${signal.txVelocityDelta.toFixed(1)}x < ${this.MIN_VELOCITY}x)`);
    }
    if (signal.tokenAgeHrs > this.MAX_AGE_HOURS) {
      reasons.push(`Token too old (${signal.tokenAgeHrs.toFixed(1)}h > ${this.MAX_AGE_HOURS}h)`);
    }

    const passes = reasons.length === 0;

    if (passes) {
      this.logger.log(`✅ Filter PASSED for ${token.symbol || token.address || 'token'}`);
    } else {
      this.logger.warn(`Filter failed for ${token.symbol || token.address || 'token'}: ${reasons.join(', ')}`);
    }

    return { passes, reasons };
  }
}