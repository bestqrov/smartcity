import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  guestId: string;

  @IsString()
  hotelId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  cleanliness: number;

  @IsInt()
  @Min(1)
  @Max(5)
  service: number;

  @IsInt()
  @Min(1)
  @Max(5)
  location: number;

  @IsInt()
  @Min(1)
  @Max(5)
  value: number;
}
