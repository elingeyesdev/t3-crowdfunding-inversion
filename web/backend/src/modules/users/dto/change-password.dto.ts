import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword1',
    description: 'Contrasena actual del usuario (minimo 8 caracteres)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contrasena actual debe tener al menos 8 caracteres' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword1',
    description: 'Nueva contrasena (minimo 8 caracteres, al menos una mayuscula y un numero)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La nueva contrasena debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La nueva contrasena debe tener al menos una mayuscula y un numero',
  })
  newPassword: string;
}
