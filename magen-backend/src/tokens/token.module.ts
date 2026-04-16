import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FilterModule } from '../filters/filter.module';
import { DebateModule } from '../debates/debate.module';

@Module({
  imports: [PrismaModule, FilterModule, DebateModule],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokensModule {}
