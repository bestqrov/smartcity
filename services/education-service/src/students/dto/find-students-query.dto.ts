import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class FindStudentsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsMongoId()
  @IsOptional()
  branchId?: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;
}
