import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsMongoId()
  categoryId: string;

  @IsMongoId()
  @IsOptional()
  hotelId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  receiptUrl?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;
}
