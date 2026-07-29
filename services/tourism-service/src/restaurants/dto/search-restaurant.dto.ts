import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export class SearchRestaurantDto {
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
  q?: string;

  @IsString()
  @IsOptional()
  cuisine?: string;

  @IsString()
  @IsOptional()
  priceRange?: string;

  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
