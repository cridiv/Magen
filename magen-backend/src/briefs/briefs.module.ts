import { Module } from '@nestjs/common'
import { BriefsController } from './briefs.controller'
import { BriefsService } from './briefs.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [BriefsController],
  providers: [BriefsService],
})
export class BriefsModule {}