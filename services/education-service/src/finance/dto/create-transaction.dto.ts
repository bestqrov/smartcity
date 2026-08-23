import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
