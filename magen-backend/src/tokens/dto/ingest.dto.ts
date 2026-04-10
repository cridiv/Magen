import { IsString, IsNumber, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SignalDto {
  @IsNumber()
  txVelocityDelta!: number;

  @IsNumber()
  buyPressureRatio!: number;

  @IsNumber()
  top10Concentration!: number;

  @IsNumber()
  holderGrowthRate!: number;

  @IsNumber()
  lpDepthUsd!: number;

  @IsNumber()
  tokenAgeHrs!: number;
}

export class IngestTokenItemDto {
  @IsString()
  address!: string;

  @IsString()
  name!: string;

  @IsString()
  symbol!: string;

  @IsNumber()
  holderCount!: number;

  @IsNumber()
  mentionCount1h!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SignalDto)
  signal: SignalDto;
}

export class IngestBatchDto {
  @IsOptional()
  tokens?: IngestTokenItemDto[];

  // Allow single token directly for flexibility
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  holderCount?: number;

  @IsOptional()
  @IsNumber()
  mentionCount1h?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SignalDto)
  signal?: SignalDto;
}