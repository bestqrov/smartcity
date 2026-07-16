import {
  IsString,
  IsEnum,
  IsNumber,
  IsEmail,
  IsArray,
  IsOptional,
  MinLength,
} from 'class-validator';

export enum TenantType {
  HOTEL = 'HOTEL',
  RIAD = 'RIAD',
  RESORT = 'RESORT',
  GUESTHOUSE = 'GUESTHOUSE',
  HOSTEL = 'HOSTEL',
}

export class CreateHotelDto {
  @IsString()
  tenantId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TenantType)
  type: TenantType;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsArray()
  @IsOptional()
  amenities?: string[];

  @IsString()
  @IsOptional()
  priceRange?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;
}
