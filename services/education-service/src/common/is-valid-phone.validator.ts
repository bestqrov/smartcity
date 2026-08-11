import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Same rules as packages/utils/src/validators.ts' isValidPhone — duplicated
 * here rather than imported because @smartcity/utils' package.json points
 * "main" at raw TypeScript source (./src/index.ts), which Next.js/ts-node
 * consumers compile on the fly but a plain `node dist/main.js` NestJS
 * runtime cannot require() directly (confirmed: no other backend service
 * depends on @smartcity/utils for this exact reason). Fixing that package's
 * build output is out of scope here; this keeps the same validation rule
 * without a broken runtime dependency.
 */
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');

  const moroccanIntl = /^\+?212[567]\d{8}$/;
  const moroccanLocal = /^0[567]\d{8}$/;
  const international = /^\+\d{10,15}$/;

  return (
    moroccanIntl.test(cleaned) ||
    moroccanLocal.test(cleaned) ||
    international.test(cleaned)
  );
}

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
