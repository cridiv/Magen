import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SignalDto {
  @Type(() => Number)
  @IsNumber()
  txVelocityDelta!: number;

  @Type(() => Number)
  @IsNumber()
  buyPressureRatio!: number;

  @Type(() => Number)
  @IsNumber()
  top10Concentration!: number;

  @Type(() => Number)
  @IsNumber()
  holderGrowthRate!: number;

  @Type(() => Number)
  @IsNumber()
  lpDepthUsd!: number;

  @Type(() => Number)
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

  @Type(() => Number)
  @IsNumber()
  holderCount!: number;

  @Type(() => Number)
  @IsNumber()
  mentionCount1h!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SignalDto)
  signal!: SignalDto;
}

export class IngestBatchDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestTokenItemDto)
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
  @Type(() => Number)
  @IsNumber()
  holderCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mentionCount1h?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SignalDto)
  signal?: SignalDto;
}
