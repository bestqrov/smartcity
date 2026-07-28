import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export enum SubscriptionStatusDto {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class UpdateSubscriptionDto {
  @IsMongoId()
  @IsOptional()
  planId?: string;

  @IsEnum(SubscriptionStatusDto)
  @IsOptional()
  status?: SubscriptionStatusDto;

  @IsDateString()
  @IsOptional()
  currentPeriodEnd?: string;

  @IsBoolean()
  @IsOptional()
  cancelAtPeriodEnd?: boolean;
}
