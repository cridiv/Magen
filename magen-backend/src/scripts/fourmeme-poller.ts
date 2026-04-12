import { execSync } from 'child_process';
import axios from 'axios';
import { getSignalSnapshot, type SignalSnapshot } from '../lib/get-signal-snapshot';

const NESTJS_INGEST_URL =
  process.env.NESTJS_INGEST_URL ?? 'http://localhost:5000/tokens/ingest';
const BATCH_SIZE = 4;

async function pollAndIngest() {
  try {
    console.log(`\n[${new Date().toISOString()}] 🔄 Polling Four.meme...`);

    const output = execSync('fourmeme token-rankings Time --pageSize=12 --json', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    if (output.includes('504') || output.includes('Gateway time-out')) {
      console.error('❌ Four.meme is down (504). Skipping...');
      return;
    }

    const parsed = JSON.parse(output);
    const rawTokens = Array.isArray(parsed) ? parsed : parsed.data || parsed.tokens || [];

    console.log(`Found ${rawTokens.length} tokens.`);

    const tokensToIngest: any[] = [];

    for (const t of rawTokens) {
      const address = t.address || t.contractAddress || t.tokenAddress;
      if (!address?.startsWith('0x')) continue;

      try {
        const signal = await getSignalSnapshot(address);

        // mentionCount1h — use real fields from Four.meme CLI response if present,
        // fall back to trendingScore or replyCount as a proxy, 0 if nothing available.
        // Never Math.random() — fake mention counts corrupt the classifier.
        const mentionCount1h =
          t.mentionCount1h ??
          t.mentions1h ??
          t.mentionCount ??
          t.trendingScore ??
          t.replyCount ??
          t.commentCount ??
          0;

        tokensToIngest.push({
          address,
          name: t.name || 'Unknown',
          symbol: t.symbol || t.ticker || '???',
          holderCount: t.holderCount || t.holders || 120,
          mentionCount1h,
          signal,
        });
      } catch (e) {
        console.warn(`Failed signal for ${address.slice(0, 8)}`);
      }
    }

    if (tokensToIngest.length === 0) return;

    for (let i = 0; i < tokensToIngest.length; i += BATCH_SIZE) {
      const batch = tokensToIngest.slice(i, i + BATCH_SIZE);
      const payload = { tokens: batch };

      console.log(
        `Sending batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tokens) to NestJS...`,
      );

      try {
        const response = await axios.post(NESTJS_INGEST_URL, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        });

        console.log(
          `✅ Batch successful! Processed ${response.data.processed || batch.length} tokens`,
        );
      } catch (err: any) {
        console.error(`❌ Batch failed!`);
        if (err.response) {
          console.error(`   Status: ${err.response.status}`);
          console.error(`   Response Body:`, JSON.stringify(err.response.data, null, 2));
        } else if (err.request) {
          console.error(`   No response from NestJS - Is the server running?`);
        } else {
          console.error(`   Error: ${err.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Outer error:', error.message);
  }
}

console.log(`🚀 Four.meme Poller Started → ${NESTJS_INGEST_URL}`);
pollAndIngest();
setInterval(pollAndIngest, 40000);