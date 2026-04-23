import { Module } from '@nestjs/common';
import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [BriefsController],
  providers: [BriefsService],
})
export class BriefsModule {}
