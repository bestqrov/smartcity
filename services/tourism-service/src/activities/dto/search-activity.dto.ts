import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class SearchActivityDto {
  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;

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
