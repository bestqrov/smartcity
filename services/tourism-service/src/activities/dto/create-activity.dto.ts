import {
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
  Min,
} from 'class-validator';

export enum ActivityType {
  EXCURSION = 'EXCURSION',
  WELLNESS = 'WELLNESS',
  SPORT = 'SPORT',
  CULTURAL = 'CULTURAL',
  CULINARY = 'CULINARY',
  ADVENTURE = 'ADVENTURE',
  ENTERTAINMENT = 'ENTERTAINMENT',
  WORKSHOP = 'WORKSHOP',
}

export class CreateActivityDto {
  @IsString()
  hotelId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(ActivityType)
  type: ActivityType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsInt()
  @Min(1)
  maxParticipants: number;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
