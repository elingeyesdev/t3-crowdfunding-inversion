import { IsNumber, IsPositive, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para aumentar el capital simulado del inversor.
 */
export class AddCapitalDto {
  @ApiProperty({
    example: 25000,
    description: 'Monto a agregar al capital disponible (BOB). Mínimo Bs. 100.',
    type: Number,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  @Min(100, { message: 'El monto mínimo para agregar capital es Bs. 100' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Recarga de capital para nuevas inversiones',
    description: 'Nota o motivo de la inyección de capital (opcional)',
    type: String,
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  notes?: string;
}
