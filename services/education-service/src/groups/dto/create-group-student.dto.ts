import { IsMongoId } from 'class-validator';

export class CreateGroupStudentDto {
  @IsMongoId()
  groupId: string;

  @IsMongoId()
  studentId: string;
}
