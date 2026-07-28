import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum BillingPeriodDto {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(BillingPeriodDto)
  @IsOptional()
  billingPeriod?: BillingPeriodDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsInt()
  @IsOptional()
  maxHotels?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
