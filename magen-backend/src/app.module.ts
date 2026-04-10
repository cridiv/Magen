import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/token.module';
import { FilterModule } from './filters/filter.module';

@Module({
  imports: [PrismaModule, FilterModule, TokensModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
