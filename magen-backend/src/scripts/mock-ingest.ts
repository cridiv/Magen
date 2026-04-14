import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TokenService } from '../tokens/token.service';
import { DebateService } from '../debates/debate.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockTokens } from '../tokens/mock-data';

// ─── Colour helpers (no dependencies) ────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

function pass(s: string)  { return `${c.green}✅ PASS${c.reset} ${s}`; }
function fail(s: string)  { return `${c.red}❌ FAIL${c.reset} ${s}`; }
function info(s: string)  { return `${c.cyan}ℹ${c.reset}  ${s}`; }
function warn(s: string)  { return `${c.yellow}⚠️  ${s}${c.reset}`; }
function bold(s: string)  { return `${c.bold}${s}${c.reset}`; }
function dim(s: string)   { return `${c.dim}${s}${c.reset}`; }

function divider(label?: string) {
  const line = '─'.repeat(60);
  console.log(label ? `\n${c.dim}${line}${c.reset} ${bold(label)}` : `\n${c.dim}${line}${c.reset}`);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'], // suppress NestJS boot noise during test
  });

  const tokenService  = app.get(TokenService);
  const debateService = app.get(DebateService);
  const prisma        = app.get(PrismaService);

  console.log(`\n${bold('🧪 Magen — Full Pipeline Mock Test')}`);
  console.log(dim(`Running ${mockTokens.length} tokens through: ingest → filter → classify → debate → brief\n`));

  const summary = {
    ingested:      0,
    filterPass:    0,
    filterFail:    0,
    classified:    0,
    worthDebating: 0,
    briefCreated:  0,
    skipped:       0,
    errors:        0,
  };

  // ── Step 1: Ingest all tokens ──────────────────────────────────────────────

  divider('Step 1 — Ingest + Filter');

  const ingestPayload = { tokens: mockTokens };
  let ingestResult: Awaited<ReturnType<typeof tokenService.ingestTokens>>;

  try {
    ingestResult = await tokenService.ingestTokens(ingestPayload);
    summary.ingested = ingestResult.processed;

    ingestResult.results.forEach((r: any) => {
      if (r.passesFilter) {
        summary.filterPass++;
        console.log(pass(`${bold(r.symbol)} ${dim(r.tokenAddress.slice(0, 10) + '...')} — passed filter`));
      } else {
        summary.filterFail++;
        console.log(fail(`${bold(r.symbol)} ${dim(r.tokenAddress.slice(0, 10) + '...')} — failed filter`));
      }
    });
  } catch (error: any) {
    console.error(`${c.red}Fatal: ingestTokens threw — ${error.message}${c.reset}`);
    await app.close();
    process.exit(1);
  }

  // ── Step 2: Run full pipeline for tokens that passed the filter ────────────

  divider('Step 2 — Classify → Debate → Brief');

  const passing = ingestResult.results.filter((r: any) => r.passesFilter);

  if (passing.length === 0) {
    console.log(warn('No tokens passed the filter — nothing to classify. Lower MIN_HOLDERS / MIN_VELOCITY thresholds to test the AI pipeline.'));
  }

  for (const result of passing) {
    const mock = mockTokens.find(t => t.address === result.tokenAddress);
    if (!mock) continue;

    console.log(`\n${bold(`→ ${mock.symbol}`)} ${dim(mock.address.slice(0, 10) + '...')}`);

    // Fetch the token + signal we just wrote so DebateService gets Prisma objects
    let token: any;
    let signal: any;

    try {
      token = await prisma.token.findUnique({ where: { address: mock.address } });
      signal = await prisma.signalSnapshot.findFirst({
        where: { tokenAddress: mock.address },
        orderBy: { timestamp: 'desc' },
      });

      if (!token || !signal) {
        console.log(warn(`  DB records not found for ${mock.symbol} — skipping`));
        summary.skipped++;
        continue;
      }
    } catch (err: any) {
      console.log(`  ${c.red}DB fetch failed: ${err.message}${c.reset}`);
      summary.errors++;
      continue;
    }

    // Call the debate orchestrator — this triggers classify → debate → brief:new
    try {
      await debateService.processToken(token, signal);

      // Check if a brief was actually created in the DB
      const brief = await prisma.memeBrief.findFirst({
        where: { tokenAddress: mock.address },
        orderBy: { createdAt: 'desc' },
      });

      summary.classified++;

      if (brief) {
        const classifierOutput = await prisma.classifierOutput.findFirst({
          where: { tokenAddress: mock.address },
          orderBy: { timestamp: 'desc' },
        });

        summary.briefCreated++;
        console.log(pass(`  Classified + debated`));
        console.log(info(`  Archetype:  ${bold(brief.culturalArchetype ?? '—')}`));
        console.log(info(`  Verdict:    ${bold(brief.verdictTag ?? '—')}`));
        console.log(info(`  Confidence: ${brief.confidenceSignal ?? '—'}`));
        console.log(info(`  Bot score:  ${classifierOutput?.botSuspicionScore?.toFixed(2) ?? '—'}`));
        console.log(info(`  Irony:      ${classifierOutput?.ironySignal ? 'yes' : 'no'}`));
        console.log(`\n  ${c.cyan}${bold('Synthesis')}${c.reset}`);
        console.log(`  ${c.white}${brief.synthesis}${c.reset}`);
      } else {
        // Classifier returned worth_debating: false — expected for low-signal tokens
        summary.skipped++;
        console.log(info(`  Classified — not worth debating (no brief created)`));

        const classifierOutput = await prisma.classifierOutput.findFirst({
          where: { tokenAddress: mock.address },
          orderBy: { timestamp: 'desc' },
        });

        if (classifierOutput) {
          console.log(info(`  Reasoning: ${classifierOutput.reasoning}`));
          console.log(info(`  Bot score: ${classifierOutput.botSuspicionScore?.toFixed(2)}`));
        }
      }
    } catch (err: any) {
      console.log(`  ${c.red}Pipeline error: ${err.message}${c.reset}`);
      summary.errors++;
    }
  }

  // ── Step 3: Summary ────────────────────────────────────────────────────────

  divider('Summary');

  console.log(`  Tokens ingested:     ${bold(String(summary.ingested))}`);
  console.log(`  Filter pass:         ${c.green}${bold(String(summary.filterPass))}${c.reset}`);
  console.log(`  Filter fail:         ${c.red}${bold(String(summary.filterFail))}${c.reset}`);
  console.log(`  Classified:          ${bold(String(summary.classified))}`);
  console.log(`  Briefs created:      ${c.green}${bold(String(summary.briefCreated))}${c.reset}`);
  console.log(`  Skipped (no debate): ${bold(String(summary.skipped))}`);
  console.log(`  Errors:              ${summary.errors > 0 ? c.red : c.green}${bold(String(summary.errors))}${c.reset}`);

  if (summary.errors > 0) {
    console.log(`\n${warn('Some tokens errored — check that Ezekiel\'s Python service is running on localhost:8000')}`);
  }

  if (summary.briefCreated === 0 && summary.filterPass > 0) {
    console.log(`\n${warn('Tokens passed the filter but no briefs were created.')}`);
    console.log(dim('  → Is the Python service running? (cd ai-service && uvicorn main:app --port 8000)'));
    console.log(dim('  → Check AiClientService logs above for classify/debate errors.'));
  }

  console.log('');
  await app.close();
}

bootstrap();