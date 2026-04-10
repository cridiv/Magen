import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TokenService } from './token.service';
import { IngestBatchDto } from './dto/ingest.dto';

@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('ingest')
  @HttpCode(201)
  async ingest(@Body() dto: IngestBatchDto): Promise<any> {
    return await this.tokenService.ingestTokens(dto);
  }
}
