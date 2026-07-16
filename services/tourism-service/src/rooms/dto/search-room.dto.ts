import { IsString, IsNumber, IsOptional, IsInt, Min } from 'class-validator';

export class SearchRoomDto {
  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  capacity?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
