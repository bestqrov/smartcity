import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { OrderStatus } from './create-order.dto';

export class SearchOrderDto {
  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
