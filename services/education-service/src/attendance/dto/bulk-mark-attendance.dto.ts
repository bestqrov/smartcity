import { ArrayMinSize, IsArray, IsDateString, IsMongoId, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarkAttendanceEntryDto } from './mark-attendance-entry.dto';

export class BulkMarkAttendanceDto {
  @IsMongoId()
  groupId: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceEntryDto)
  entries: MarkAttendanceEntryDto[];
}
