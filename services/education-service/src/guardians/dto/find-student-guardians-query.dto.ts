import { IsMongoId, IsOptional } from 'class-validator';

export class FindStudentGuardiansQueryDto {
  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  guardianId?: string;
}
