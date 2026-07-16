import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class SearchActivityDto {
  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  minPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  maxPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
