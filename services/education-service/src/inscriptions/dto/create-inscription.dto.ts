import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InscriptionType } from '@prisma/client';

export class CreateInscriptionDto {
  @IsMongoId()
  studentId: string;

  @IsEnum(InscriptionType)
  type: InscriptionType;

  @IsString()
  @MinLength(1)
  category: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
