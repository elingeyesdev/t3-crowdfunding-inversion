import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** El front envía "" en campos opcionales; sin esto @IsUrl() falla con cadena vacía. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) return undefined;
  return value;
}

/**
 * DTO para crear un perfil de emprendedor (EDT 1.1 / 1.2).
 * Campos mínimos requeridos: firstName, lastName.
 */
export class CreateEntrepreneurProfileDto {
  @ApiProperty({ example: 'Carlos', description: 'Nombre del emprendedor' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Mendoza', description: 'Apellido del emprendedor' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: 'Carlos M.', description: 'Nombre público' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiProperty({ example: 'Emprendedor apasionado por la tecnología con más de 10 años de experiencia...', description: 'Biografía' })
  @IsString()
  @IsNotEmpty()
  @MinLength(30, { message: 'La biografía debe tener al menos 30 caracteres' })
  @MaxLength(2000)
  bio: string;

  @ApiPropertyOptional({ example: 'TechVentures SRL', description: 'Nombre de la empresa' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://techventures.com', description: 'Sitio web' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl()
  @MaxLength(512)
  website?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/carlosmendoza', description: 'LinkedIn' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl()
  @MaxLength(512)
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'Calle 100 #15-20', description: 'Dirección' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string;

  @ApiPropertyOptional({ example: 'Bogotá', description: 'Ciudad' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Cundinamarca', description: 'Estado/Provincia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'Colombia', description: 'País' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '110111', description: 'Código postal' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: '0012345678', description: 'Número de cuenta bancaria' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'Banco Nacional', description: 'Nombre del banco' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;
}
