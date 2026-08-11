import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsValidPhone } from '../../common/is-valid-phone.validator';

export class CreateGuardianDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsValidPhone()
  @IsOptional()
  phone?: string;
}
