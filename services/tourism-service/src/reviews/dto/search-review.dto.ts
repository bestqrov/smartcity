import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class SearchReviewDto {
  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  guestId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
