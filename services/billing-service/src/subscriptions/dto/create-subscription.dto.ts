import { IsMongoId, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsMongoId()
  @IsNotEmpty()
  tenantId: string;

  @IsMongoId()
  @IsNotEmpty()
  planId: string;

  @IsDateString()
  @IsOptional()
  currentPeriodEnd?: string;
}
