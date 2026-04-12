import { Module } from '@nestjs/common'
import { BriefsGateway } from '../briefs/briefs.gateway'

@Module({
  providers: [BriefsGateway],
  exports: [BriefsGateway],
})
export class GatewayModule {}