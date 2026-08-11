import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateStudentGuardianDto } from './create-student-guardian.dto';

// studentId/guardianId are intentionally excluded — retargeting a
// relationship to a different student or guardian means detaching and
// re-attaching, not updating in place.
class UpdatableStudentGuardianFields extends OmitType(CreateStudentGuardianDto, [
  'studentId',
  'guardianId',
] as const) {}

export class UpdateStudentGuardianDto extends PartialType(
  UpdatableStudentGuardianFields,
) {}
