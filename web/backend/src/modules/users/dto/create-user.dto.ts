import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'usuario@gmail.com',
    description: 'Correo electrónico único del usuario',
  })
  @IsEmail({}, { message: 'El email no tiene formato válido' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña (mínimo 8 caracteres, al menos una mayúscula y un número)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe tener al menos una mayúscula y un número',
  })
  password: string;

  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Teléfono (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'es',
    enum: ['es', 'en'],
    description: 'Idioma preferido',
    default: 'es',
  })
  @IsOptional()
  @IsIn(['es', 'en'])
  preferredLanguage?: string;

  @ApiPropertyOptional({
    enum: ['investor', 'entrepreneur'],
    description: 'Rol principal al registrarse (se guarda en user_roles)',
  })
  @IsOptional()
  @IsIn(['investor', 'entrepreneur'])
  signupRole?: 'investor' | 'entrepreneur';
}
