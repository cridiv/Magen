import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TokenService } from '../tokens/token.service';
import { mockTokens } from '../tokens/mock-data';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tokensService = app.get(TokenService);

  console.log('🚀 Starting mock ingestion...\n');

  const payload = {
    tokens: mockTokens,
  };

  try {
    const result = await tokensService.ingestTokens(payload);
    console.log('✅ Mock ingestion completed successfully!');
    console.log(`Processed: ${result.processed} tokens\n`);

    result.results.forEach((r: any) => {
      console.log(
        `${r.passesFilter ? '✅ PASS' : '❌ FAIL'} | ${r.symbol} (${r.tokenAddress.slice(0, 8)}...)`
      );
    });
  } catch (error) {
    console.error('❌ Mock ingestion failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();