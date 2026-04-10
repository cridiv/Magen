import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

// ==================== CONFIG ====================
const RPC_ENDPOINTS = [
  'https://bsc-dataseed.bnbchain.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.ninicoin.io',
];

const PANCAKE_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc';

// ===============================================

const clients = RPC_ENDPOINTS.map(url => 
  createPublicClient({ chain: bsc, transport: http(url) })
);

export interface SignalSnapshot {
  top10Concentration: number;   // 0.0 - 1.0
  buyPressureRatio: number;     // buyers / sellers
  lpDepthUsd: number;
  txVelocityDelta: number;      // current vs 1h average (e.g. 2.3 = 2.3x)
  holderGrowthRate: number;     // new holders per hour
  tokenAgeHrs: number;
}

/**
 * Gets on-chain signal snapshot for a token
 * Simple version first - we will improve accuracy later
 */
export async function getSignalSnapshot(tokenAddress: string): Promise<SignalSnapshot> {
  console.log(`Fetching on-chain signals for ${tokenAddress.slice(0, 8)}...`);

  try {
    // Use first available RPC client
    const client = clients[0];

    // TODO: In real implementation we would:
    // 1. Get token age
    // 2. Get liquidity from PancakeSwap pool
    // 3. Get holder distribution
    // 4. Approximate velocity and buy pressure from recent transactions

    // For now, we return realistic mock values with some randomness
    // (This will be replaced with real calls once we test)

    const baseSignal: SignalSnapshot = {
      top10Concentration: 0.38 + Math.random() * 0.35,     // 38% - 73%
      buyPressureRatio: 0.8 + Math.random() * 2.5,         // 0.8x - 3.3x
      lpDepthUsd: 4200 + Math.random() * 28000,            // $4.2k - $32k
      txVelocityDelta: 0.9 + Math.random() * 3.8,          // 0.9x - 4.7x
      holderGrowthRate: Math.floor(12 + Math.random() * 95),
      tokenAgeHrs: 0.5 + Math.random() * 7,
    };

    console.log(`✅ Signal snapshot ready for ${tokenAddress.slice(0, 8)}...`);
    return baseSignal;

  } catch (error) {
    console.error(`Failed to get signal for ${tokenAddress}:`, error);
    
    // Return safe default values if everything fails
    return {
      top10Concentration: 0.55,
      buyPressureRatio: 1.2,
      lpDepthUsd: 6500,
      txVelocityDelta: 1.8,
      holderGrowthRate: 35,
      tokenAgeHrs: 2.5,
    };
  }
}