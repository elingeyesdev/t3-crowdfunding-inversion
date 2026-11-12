import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@gmail.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'El email no tiene formato válido' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
