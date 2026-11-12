import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(propertyValue: any): boolean {
    // Si el valor no existe o está vacío, delegarlo a @IsOptional() u otros
    if (!propertyValue) return true;

    const dateToCheck = new Date(propertyValue);

    // Si la fecha es inválida (NaN), fallar validación
    if (isNaN(dateToCheck.getTime())) {
      return false;
    }

    const now = new Date();
    // Comparar sin la hora para permitir cualquier hora del día futuro
    now.setHours(0, 0, 0, 0);
    dateToCheck.setHours(0, 0, 0, 0);

    // La fecha debe ser estrictamente en el futuro (no permite hoy)
    return dateToCheck > now;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} debe ser una fecha en el futuro`;
  }
}

/**
 * Decorador de class-validator que asegura que la fecha sea estrictamente en el futuro.
 * No permite fechas pasadas ni la fecha de hoy.
 */
export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}
