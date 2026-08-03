import { IsInt, IsMongoId, IsNumber, Min } from 'class-validator';

export class CreatePurchaseItemDto {
  @IsMongoId()
  stockItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;
}
