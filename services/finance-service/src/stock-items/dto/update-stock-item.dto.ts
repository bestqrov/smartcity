import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStockItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;
}
