import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateFormationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(1)
  duration: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;
}
