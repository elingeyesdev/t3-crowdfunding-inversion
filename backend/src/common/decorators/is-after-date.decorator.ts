import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAfterDate', async: false })
export class IsAfterDateConstraint implements ValidatorConstraintInterface {
  validate(propertyValue: any, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];

    // Si el valor no existe o no es válido, delegarlo a @IsNotEmpty() u otros
    if (!propertyValue) return true;

    // Fecha de inicio: si no viene explícita en el DTO, asumimos momento actual
    const startDate = relatedValue ? new Date(relatedValue) : new Date();
    const endDate = new Date(propertyValue);

    // Si algunas de las fechas son inválidas (NaN), no podemos comparar bien
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
       return false;
    }

    // La fecha de fin (endDate) debe ser estrictamente posterior
    return endDate.getTime() > startDate.getTime();
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    return `La fecha de cierre (${args.property}) debe ser posterior a la fecha de inicio (${relatedPropertyName || 'hoy'})`;
  }
}

/**
 * Decorador de class-validator que asegura que la propiedad actual (una fecha) sea 
 * posterior a otra propiedad dada (startDate).
 * Si la otra propiedad no está presente, se compara contra la fecha y hora actual.
 */
export function IsAfterDate(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsAfterDateConstraint,
    });
  };
}
