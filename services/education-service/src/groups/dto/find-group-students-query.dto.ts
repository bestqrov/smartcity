import { IsMongoId, IsOptional } from 'class-validator';

export class FindGroupStudentsQueryDto {
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;
}
