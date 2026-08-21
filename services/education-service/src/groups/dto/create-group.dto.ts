import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsMongoId()
  branchId: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;
}
