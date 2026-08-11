import { IsString, IsOptional, IsDateString, IsMongoId, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsMongoId()
  branchId: string;

  @IsString()
  @MinLength(1)
  registrationNumber: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}
