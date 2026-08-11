import { IsBoolean, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { GuardianRelationshipType } from '@prisma/client';

export class CreateStudentGuardianDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  guardianId: string;

  @IsEnum(GuardianRelationshipType)
  relationshipType: GuardianRelationshipType;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmergencyContact?: boolean;

  @IsBoolean()
  @IsOptional()
  canPickUp?: boolean;

  @IsBoolean()
  @IsOptional()
  canCommunicate?: boolean;

  @IsBoolean()
  @IsOptional()
  financiallyResponsible?: boolean;
}
