import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/token.module';
import { FilterModule } from './filters/filter.module';
import { AiClientModule } from './ai-client/ai-client.module';
import { BriefsModule } from './briefs/briefs.module';
import { DebateModule } from './debates/debate.module';

@Module({
  imports: [PrismaModule, FilterModule, TokensModule, AiClientModule, BriefsModule, DebateModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
