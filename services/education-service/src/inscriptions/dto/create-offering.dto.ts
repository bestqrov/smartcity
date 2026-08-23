import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class CreateOfferingDto {
  @IsEnum(InscriptionType)
  type: InscriptionType;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;
}
