import { execSync } from 'child_process';
import axios from 'axios';
import { getSignalSnapshot, type SignalSnapshot } from '../lib/get-signal-snapshot';
import type { IngestTokenItemDto } from '../tokens/dto/ingest.dto';

const NESTJS_INGEST_URL = 'http://localhost:3000/tokens/ingest';

type FourmemeTokenSource = {
  address?: unknown;
  contractAddress?: unknown;
  tokenAddress?: unknown;
  name?: unknown;
  symbol?: unknown;
  ticker?: unknown;
  holderCount?: unknown;
  holders?: unknown;
};

function extractRawTokens(parsed: unknown): FourmemeTokenSource[] {
  if (Array.isArray(parsed)) {
    return parsed as FourmemeTokenSource[];
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as { data?: unknown; tokens?: unknown };

    if (Array.isArray(record.data)) {
      return record.data as FourmemeTokenSource[];
    }

    if (Array.isArray(record.tokens)) {
      return record.tokens as FourmemeTokenSource[];
    }
  }

  return [];
}

async function pollAndIngest() {
  try {
    console.log(`\n[${new Date().toISOString()}] 🔄 Polling Four.meme...`);

    const output = execSync(
      'fourmeme token-rankings Time --pageSize=12 --json',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();

    if (output.includes('504') || output.includes('Gateway time-out') || output.includes('<!DOCTYPE')) {
      console.error('❌ Four.meme is down (504 Gateway Timeout). Skipping cycle.');
      return;
    }

    const parsed: unknown = JSON.parse(output);
    const rawTokens = extractRawTokens(parsed);

    console.log(`Found ${rawTokens.length} tokens from Four.meme.`);

    const tokensToIngest: IngestTokenItemDto[] = [];

    for (const t of rawTokens) {
      const address =
        typeof t.address === 'string'
          ? t.address
          : typeof t.contractAddress === 'string'
            ? t.contractAddress
            : typeof t.tokenAddress === 'string'
              ? t.tokenAddress
              : '';
      if (!address || !address.startsWith('0x')) continue;

      try {
        // ←←← This is the key integration
        const signal: SignalSnapshot = await getSignalSnapshot(address);

        const name = typeof t.name === 'string' ? t.name : 'Unknown Token';
        const symbol = typeof t.symbol === 'string'
          ? t.symbol
          : typeof t.ticker === 'string'
            ? t.ticker
            : '???';
        const holderCount =
          typeof t.holderCount === 'number'
            ? t.holderCount
            : typeof t.holders === 'number'
              ? t.holders
              : 120;

        tokensToIngest.push({
          address,
          name,
          symbol,
          holderCount,
          mentionCount1h: Math.floor(Math.random() * 90) + 25,
          signal: signal,   // Real call instead of placeholder
        });

        console.log(`   → ${symbol} | LP: $${signal.lpDepthUsd.toFixed(0)} | Velocity: ${signal.txVelocityDelta.toFixed(1)}x`);
      } catch (err) {
        console.warn(`   ⚠️  Failed to get signal for ${address.slice(0,8)}... skipping`);
      }
    }

    const BATCH_SIZE = 5;
    for (let i = 0; i < tokensToIngest.length; i += BATCH_SIZE) {
      const batch = tokensToIngest.slice(i, i + BATCH_SIZE);
      const payload = { tokens: batch };

      console.log(`Sending batch ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} tokens) to NestJS...`);

      const response = await axios.post(NESTJS_INGEST_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 12000,
      });

      console.log(`✅ Batch success: ${response.data.processed} tokens processed`);
    }

    const payload = { tokens: tokensToIngest };

    console.log(`Sending ${tokensToIngest.length} enriched tokens to NestJS...`);

    const response = await axios.post(NESTJS_INGEST_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    console.log(`🎉 SUCCESS: Ingested ${response.data.processed} tokens into backend`);

  } catch (error: any) {
    console.error('❌ Polling cycle failed:', error.message);
    if (error.response) {
      console.error('   NestJS responded with:', error.response.status, error.response.data);
    }
  }
}

// Start the poller
console.log('🚀 Four.meme Poller Started with getSignalSnapshot integration');
pollAndIngest();                    // First run immediately
setInterval(pollAndIngest, 35000);  // Every 35 seconds