import { IsString, IsNumber, IsOptional, IsInt, Min } from 'class-validator';

export class SearchHotelDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minRating?: number;

  @IsString()
  @IsOptional()
  maxPrice?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
