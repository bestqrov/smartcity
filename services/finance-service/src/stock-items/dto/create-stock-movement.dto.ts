import { IsIn, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export const MANUAL_MOVEMENT_TYPES = ['RESTOCK', 'WASTE', 'ADJUSTMENT'] as const;

export class CreateStockMovementDto {
  @IsIn(MANUAL_MOVEMENT_TYPES)
  type: 'RESTOCK' | 'WASTE' | 'ADJUSTMENT';

  @IsInt()
  @NotEquals(0)
  quantityChange: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
