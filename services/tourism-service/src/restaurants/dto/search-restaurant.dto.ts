import {
  IsString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class SearchRestaurantDto {
  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  cuisine?: string;

  @IsString()
  @IsOptional()
  priceRange?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
