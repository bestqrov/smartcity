import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class FindAttendanceQueryDto {
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;
}
