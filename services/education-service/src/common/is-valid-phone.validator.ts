import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isValidPhone } from '@smartcity/utils';

/**
 * Validates a phone number using the same rules as the rest of SmartCity
 * (packages/utils/src/validators.ts) — Moroccan local/international formats
 * plus generic international numbers.
 */
export function IsValidPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && isValidPhone(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return `${propertyName} must be a valid phone number`;
        },
      },
    });
  };
}
