import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  hotelId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  cuisine?: string[];

  @IsString()
  @IsOptional()
  priceRange?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  openingHours?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
