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

export enum RoomType {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TWIN = 'TWIN',
  SUITE = 'SUITE',
  DELUXE = 'DELUXE',
  FAMILY = 'FAMILY',
  PENTHOUSE = 'PENTHOUSE',
  DORMITORY = 'DORMITORY',
}

export class CreateRoomDto {
  @IsString()
  hotelId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(RoomType)
  type: RoomType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsArray()
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
