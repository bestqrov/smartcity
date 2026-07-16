import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  MinLength,
} from 'class-validator';

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class CreateOrderDto {
  @IsString()
  bookingId: string;

  @IsString()
  @MinLength(2)
  type: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}
