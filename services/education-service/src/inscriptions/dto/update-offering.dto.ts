import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class UpdateOfferingDto {
  @IsEnum(InscriptionType)
  @IsOptional()
  type?: InscriptionType;

  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
