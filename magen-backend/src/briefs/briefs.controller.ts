import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Post,
  Body,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BriefsService } from './briefs.service';

type CreateAgentLogDto = {
  tokenAddress?: string | null;
  eventType: string;
  message: string;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  timestamp?: string;
};

@Controller('briefs')
export class BriefsController {
  constructor(private readonly briefsService: BriefsService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.briefsService.findAll({ page, limit });
  }

  @Get('logs')
  findLogs(
    @Query('limit', new DefaultValuePipe(40), ParseIntPipe) limit: number,
    @Query('tokenAddress') tokenAddress?: string,
  ) {
    return this.briefsService.findRecentAgentLogs({ limit, tokenAddress });
  }

  @Post('logs')
  createLog(@Body() body: CreateAgentLogDto) {
    return this.briefsService.appendAgentLog(body);
  }
}
