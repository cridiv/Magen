import { Module } from '@nestjs/common'
import { DebateService } from './debate.service'
import { AiClientModule } from '../ai-client/ai-client.module'
import { GatewayModule } from '../gateway/gateway.module'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule, AiClientModule, GatewayModule],
  providers: [DebateService],
  exports: [DebateService],
})
export class DebateModule {}