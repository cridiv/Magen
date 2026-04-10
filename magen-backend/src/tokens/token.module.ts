import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FilterModule } from '../filters/filter.module';

@Module({
  imports: [PrismaModule, FilterModule],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokensModule {}
