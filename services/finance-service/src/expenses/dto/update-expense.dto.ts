import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional } from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(
  OmitType(CreateExpenseDto, ['hotelId'] as const),
) {
  @IsMongoId()
  @IsOptional()
  hotelId?: string | null;
}
