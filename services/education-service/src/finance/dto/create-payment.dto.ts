import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  studentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(2)
  method: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
