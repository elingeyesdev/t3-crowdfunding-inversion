import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsEnum,
  IsNumber,
  IsPositive,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type InvestorType = 'individual' | 'institutional' | 'angel';

/**
 * DTO para crear un perfil de inversor.
 * Campos mínimos requeridos: firstName, lastName.
 */
export class CreateInvestorProfileDto {
  @ApiProperty({ example: 'Laura', description: 'Nombre del inversor' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Gómez', description: 'Apellido del inversor' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: 'Laura G.', description: 'Nombre público' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Inversora con experiencia en startups de tecnología...', description: 'Biografía' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({
    example: 'individual',
    enum: ['individual', 'institutional', 'angel'],
    description: 'Tipo de inversor',
  })
  @IsOptional()
  @IsEnum(['individual', 'institutional', 'angel'])
  investorType?: InvestorType;

  @ApiPropertyOptional({ example: '123456789', description: 'Número de identificación fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: 'Calle 72 #10-34', description: 'Dirección línea 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Apto 501', description: 'Dirección línea 2' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Medellín', description: 'Ciudad' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Antioquia', description: 'Estado/Provincia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'Colombia', description: 'País' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '050001', description: 'Código postal' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    example: ['uuid-categoria-1', 'uuid-categoria-2'],
    description: 'IDs de categorías de interés',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  preferredCategories?: string[];

  @ApiPropertyOptional({ example: 500, description: 'Monto mínimo de inversión (Bs)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  minInvestment?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Monto máximo de inversión (Bs)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxInvestment?: number;
}
