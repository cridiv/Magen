import { execSync } from 'child_process';
import axios from 'axios';

const NESTJS_INGEST_URL = 'http://localhost:5000/tokens/ingest';
const MAX_RETRIES = 3;

async function pollAndIngest(attempt = 1) {
  try {
    console.log(`\n[${new Date().toISOString()}] 🔄 Polling Four.meme (Attempt ${attempt})...`);

    const output = execSync(
      'fourmeme token-rankings Time --pageSize=12 --json',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();

    if (output.includes('504') || output.includes('Gateway time-out') || output.includes('<!DOCTYPE html>')) {
      throw new Error('Four.meme returned Cloudflare error page');
    }

    const parsed = JSON.parse(output);
    const rawTokens = Array.isArray(parsed) ? parsed : parsed.data || parsed.tokens || [];

    console.log(`✅ Found ${rawTokens.length} tokens from Four.meme`);

    const payload = {
      tokens: rawTokens.map((t: any) => ({
        address: t.address || t.contractAddress || t.tokenAddress,
        name: t.name || 'Unknown',
        symbol: t.symbol || t.ticker || '???',
        holderCount: t.holderCount || t.holders || 80,
        mentionCount1h: Math.floor(Math.random() * 90) + 25,
        signal: {
          txVelocityDelta: 1.6 + Math.random() * 2.8,
          buyPressureRatio: 1.0 + Math.random() * 2.2,
          top10Concentration: 0.32 + Math.random() * 0.48,
          holderGrowthRate: Math.floor(25 + Math.random() * 65),
          lpDepthUsd: 4800 + Math.random() * 22000,
          tokenAgeHrs: 0.1 + Math.random() * 6,
        }
      })).filter(t => t.address?.startsWith('0x'))
    };

    if (payload.tokens.length === 0) return;

    console.log(`Sending ${payload.tokens.length} tokens to NestJS...`);

    const response = await axios.post(NESTJS_INGEST_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 12000,
    });

    console.log(`🎉 SUCCESS: Ingested ${response.data.processed} tokens`);

  } catch (error: any) {
    console.error(`❌ Attempt ${attempt} failed`);

    if (error.message.includes('504') || error.message.includes('Gateway')) {
      console.error('   Four.meme is currently overloaded (504)');
    } else if (error.response) {
      console.error(`   NestJS Error ${error.response.status}:`, error.response.data);
    } else {
      console.error('   Error:', error.message);
    }

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`   Retrying in 8 seconds...`);
      setTimeout(() => pollAndIngest(attempt + 1), 8000);
    } else {
      console.log('   Max retries reached. Will try again in next cycle.');
    }
  }
}

// Start Poller
console.log('🚀 Four.meme Poller Started with retry logic');
pollAndIngest();                    // First attempt
setInterval(() => pollAndIngest(), 35000);   // Every 35 seconds