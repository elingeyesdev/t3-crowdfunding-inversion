import { IsUUID, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InvestmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID de la campaña o proyecto a invertir',
    type: String,
  })
  @IsUUID('4', { message: 'El campaignId debe ser un UUID válido (v4)' })
  campaignId: string;

  @ApiProperty({
    example: 100.5,
    description: 'Monto de la inversión (debe ser estrictamente positivo)',
    type: Number,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto de inversión debe ser un número válido' })
  @IsPositive({ message: 'El monto de inversión debe ser mayor a 0' })
  amount: number;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID del nivel de recompensa seleccionado (opcional, solo para campañas tipo reward)',
    type: String,
  })
  @IsOptional()
  @IsUUID('4', { message: 'El rewardTierId debe ser un UUID válido (v4)' })
  rewardTierId?: string;
}
