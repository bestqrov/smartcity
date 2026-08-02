import { IsIn, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPurchaseDto {
  @IsMongoId()
  @IsOptional()
  hotelId?: string;

  @IsIn(['PENDING', 'RECEIVED', 'CANCELLED'])
  @IsOptional()
  status?: 'PENDING' | 'RECEIVED' | 'CANCELLED';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
