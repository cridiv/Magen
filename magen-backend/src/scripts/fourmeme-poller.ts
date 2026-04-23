import { execSync } from 'child_process';
import axios from 'axios';

type FourmemeToken = {
  address?: string;
  contractAddress?: string;
  tokenAddress?: string;
  name?: string;
  symbol?: string;
  ticker?: string;
  holderCount?: number;
  holders?: number;
  mentionCount1h?: number;
  mentions1h?: number;
  mentionCount?: number;
  trendingScore?: number;
};

type FourmemeResponse =
  | FourmemeToken[]
  | {
      data?: FourmemeToken[];
      tokens?: FourmemeToken[];
    };

type DexscreenerPair = {
  chainId?: string;
  liquidity?: { usd?: number | string };
  marketCap?: number | string;
  fdv?: number | string;
  volume?: { h24?: number | string };
};

type IngestSignal = {
  lpDepthUsd: number;
  txVelocityDelta: number;
  buyPressureRatio: number;
  top10Concentration: number;
  holderGrowthRate: number;
  tokenAgeHrs: number;
};

type IngestTokenItem = {
  address: string;
  name: string;
  symbol: string;
  holderCount: number;
  mentionCount1h: number;
  signal: IngestSignal;
};

type IngestResponse = {
  success?: boolean;
  processed?: number;
  results?: unknown[];
};

type PollerLogPayload = {
  eventType: string;
  message: string;
  tokenAddress?: string;
  metadata?: Record<string, unknown>;
};

const NESTJS_INGEST_URL =
  process.env.NESTJS_INGEST_URL ?? 'http://localhost:5000/tokens/ingest';
const NESTJS_LOG_URL =
  process.env.NESTJS_LOG_URL ?? 'http://localhost:5000/briefs/logs';
const NESTJS_INGEST_TIMEOUT_MS = Number(
  process.env.NESTJS_INGEST_TIMEOUT_MS ?? 90000,
);
const NESTJS_INGEST_RETRIES = Number(process.env.NESTJS_INGEST_RETRIES ?? 2);
const NESTJS_BATCH_DELAY_MS = Number(process.env.NESTJS_BATCH_DELAY_MS ?? 800);
const EMIT_POLLER_LOGS = process.env.EMIT_POLLER_LOGS === 'true';
const BATCH_SIZE = 6;
let pollInFlight = false;

function normalizeTokens(parsed: FourmemeResponse): FourmemeToken[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  return parsed.data ?? parsed.tokens ?? [];
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'string' ? Number(value) : value;

  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? numeric
    : fallback;
}

function resolveDepth(pair: DexscreenerPair | undefined): number {
  if (!pair) return 0;

  const liquidityUsd = toNumber(pair.liquidity?.usd, 0);
  if (liquidityUsd > 0) return liquidityUsd;

  const marketCap = toNumber(pair.marketCap, 0);
  if (marketCap > 0) return marketCap;

  const fdv = toNumber(pair.fdv, 0);
  if (fdv > 0) return fdv;

  const volume24h = toNumber(pair.volume?.h24, 0);
  return volume24h > 0 ? volume24h * 2 : 0;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return '';
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPollerLog(payload: PollerLogPayload): Promise<void> {
  if (!EMIT_POLLER_LOGS) {
    return;
  }

  try {
    await axios.post(
      NESTJS_LOG_URL,
      {
        tokenAddress: payload.tokenAddress ?? null,
        eventType: payload.eventType,
        message: payload.message,
        metadata: payload.metadata,
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 4000,
      },
    );
  } catch {
    // Never fail polling because log forwarding is unavailable.
  }
}

async function sendIngestBatch(payload: {
  tokens: IngestTokenItem[];
}): Promise<IngestResponse> {
  for (let attempt = 1; attempt <= NESTJS_INGEST_RETRIES; attempt++) {
    try {
      const response = await axios.post<IngestResponse>(
        NESTJS_INGEST_URL,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: NESTJS_INGEST_TIMEOUT_MS,
        },
      );

      return response.data;
    } catch (error) {
      const isLastAttempt = attempt === NESTJS_INGEST_RETRIES;

      if (isLastAttempt) {
        throw error;
      }

      const reason =
        axios.isAxiosError(error) && error.code === 'ECONNABORTED'
          ? 'timeout'
          : 'request_error';

      console.warn(
        `⚠️ Ingest batch attempt ${attempt}/${NESTJS_INGEST_RETRIES} failed (${reason}), retrying...`,
      );
      await delay(1000 * attempt);
    }
  }

  throw new Error('Ingest batch failed after retries');
}

async function fetchFourmemeOutput(): Promise<string | null> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return execSync('fourmeme token-rankings Time --pageSize=15 --json', {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stdout =
        typeof error === 'object' && error && 'stdout' in error
          ? extractText((error as { stdout?: unknown }).stdout)
          : '';
      const stderr =
        typeof error === 'object' && error && 'stderr' in error
          ? extractText((error as { stderr?: unknown }).stderr)
          : '';
      const combined = `${message}\n${stdout}\n${stderr}`.toLowerCase();

      if (
        combined.includes('fetch failed') ||
        combined.includes('gateway') ||
        combined.includes('504')
      ) {
        console.warn(
          `⚠️ Four.meme fetch failed (attempt ${attempt}/${maxAttempts})`,
        );

        if (attempt < maxAttempts) {
          await delay(1500 * attempt);
          continue;
        }

        return null;
      }

      throw error;
    }
  }

  return null;
}

async function pollAndIngest(): Promise<void> {
  if (pollInFlight) {
    console.warn('⚠️ Previous poll still running — skipping');
    await sendPollerLog({
      eventType: 'poll_skipped',
      message: 'Previous poll still running',
    });
    return;
  }

  pollInFlight = true;

  try {
    const cycleStart = new Date().toISOString();
    console.log(`\n[${cycleStart}] 🔄 Polling Four.meme...`);
    await sendPollerLog({
      eventType: 'poll_started',
      message: 'Polling Four.meme',
      metadata: { cycleStart },
    });

    const output = await fetchFourmemeOutput();

    if (!output) {
      console.error('❌ Four.meme unavailable. Skipping this poll cycle...');
      await sendPollerLog({
        eventType: 'poll_failed',
        message: 'Four.meme unavailable. Poll cycle skipped',
      });
      return;
    }

    const rawTokens = normalizeTokens(JSON.parse(output) as FourmemeResponse);
    console.log(`Found ${rawTokens.length} raw tokens.`);
    await sendPollerLog({
      eventType: 'poll_tokens_found',
      message: `Found ${rawTokens.length} raw tokens`,
      metadata: { rawCount: rawTokens.length },
    });

    const lightBatch: IngestTokenItem[] = [];

    for (const token of rawTokens) {
      const address =
        token.address ?? token.contractAddress ?? token.tokenAddress;

      if (typeof address !== 'string' || !address.startsWith('0x')) {
        continue;
      }

      let lpDepthUsd = 0;

      try {
        const response = await axios.get<{ pairs?: DexscreenerPair[] }>(
          `https://api.dexscreener.com/latest/dex/tokens/${address.toLowerCase()}`,
          { timeout: 6000 },
        );

        const bscPairs = (response.data.pairs ?? []).filter(
          (candidate) => candidate.chainId === 'bsc',
        );
        const bestPair = bscPairs.reduce<DexscreenerPair | undefined>(
          (best, candidate) => {
            if (!best) return candidate;
            return resolveDepth(candidate) > resolveDepth(best)
              ? candidate
              : best;
          },
          undefined,
        );

        lpDepthUsd = Math.round(resolveDepth(bestPair));
      } catch {
        lpDepthUsd = 0;
      }

      lightBatch.push({
        address,
        name: token.name ?? 'Unknown',
        symbol: token.symbol ?? token.ticker ?? '???',
        holderCount: token.holderCount ?? token.holders ?? 80,
        mentionCount1h:
          token.mentionCount1h ??
          token.mentions1h ??
          token.mentionCount ??
          token.trendingScore ??
          0,
        signal: {
          lpDepthUsd,
          txVelocityDelta: 1.0,
          buyPressureRatio: 1.2,
          top10Concentration: 0.45,
          holderGrowthRate: 30,
          tokenAgeHrs: 2.0,
        },
      });
    }

    for (let index = 0; index < lightBatch.length; index += BATCH_SIZE) {
      const batch = lightBatch.slice(index, index + BATCH_SIZE);
      const payload = { tokens: batch };
      const batchNumber = Math.floor(index / BATCH_SIZE) + 1;

      console.log(
        `Sending light batch ${batchNumber} (${batch.length} tokens)...`,
      );
      await sendPollerLog({
        eventType: 'poll_batch_sent',
        message: `Sending light batch ${batchNumber} (${batch.length} tokens)`,
        metadata: { batchNumber, batchSize: batch.length },
      });

      try {
        const response = await sendIngestBatch(payload);

        console.log('✅ Light batch successful');
        console.log(`   Processed: ${response.processed ?? batch.length}`);
        await sendPollerLog({
          eventType: 'poll_batch_success',
          message: `Light batch ${batchNumber} successful`,
          metadata: {
            batchNumber,
            batchSize: batch.length,
            processed: response.processed ?? batch.length,
          },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error(
            '❌ Light batch failed:',
            error.response?.data ?? error.message,
          );
          await sendPollerLog({
            eventType: 'poll_batch_failed',
            message: `Light batch ${batchNumber} failed`,
            metadata: {
              batchNumber,
              batchSize: batch.length,
              reason: String(error.response?.data ?? error.message),
            },
          });
        } else if (error instanceof Error) {
          console.error('❌ Light batch failed:', error.message);
          await sendPollerLog({
            eventType: 'poll_batch_failed',
            message: `Light batch ${batchNumber} failed`,
            metadata: {
              batchNumber,
              batchSize: batch.length,
              reason: error.message,
            },
          });
        } else {
          console.error('❌ Light batch failed:', String(error));
          await sendPollerLog({
            eventType: 'poll_batch_failed',
            message: `Light batch ${batchNumber} failed`,
            metadata: {
              batchNumber,
              batchSize: batch.length,
              reason: String(error),
            },
          });
        }
      }

      if (index + BATCH_SIZE < lightBatch.length) {
        await delay(NESTJS_BATCH_DELAY_MS);
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Polling cycle failed:', error.message);
      await sendPollerLog({
        eventType: 'poll_failed',
        message: `Polling cycle failed: ${error.message}`,
      });
    } else {
      console.error('Polling cycle failed:', String(error));
      await sendPollerLog({
        eventType: 'poll_failed',
        message: `Polling cycle failed: ${String(error)}`,
      });
    }
  } finally {
    await sendPollerLog({
      eventType: 'poll_finished',
      message: 'Polling cycle finished',
    });
    pollInFlight = false;
  }
}

console.log('🚀 Four.meme Poller Started (Light Mode)');
void pollAndIngest();
setInterval(() => {
  void pollAndIngest();
}, 45000);
