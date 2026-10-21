import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

/**
 * DTO para filtrar campañas del emprendedor (EDT 1.3).
 * Extiende PaginationDto para reutilizar page/limit/offset.
 */
export class QueryCampaignsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['all', 'draft', 'approval', 'published', 'archived'],
    description:
      'Filtro rápido por etapa (si se envía `status` explícito, tiene prioridad)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'draft', 'approval', 'published', 'archived'])
  filterPreset?: string;

  @ApiPropertyOptional({
    enum: [
      'draft', 'pending_review', 'in_review', 'approved', 'rejected',
      'published', 'funded', 'partially_funded', 'failed',
      'cancelled', 'completed', 'suspended',
    ],
    description: 'Filtrar por estado de campaña',
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'draft', 'pending_review', 'in_review', 'approved', 'rejected',
    'published', 'funded', 'partially_funded', 'failed',
    'cancelled', 'completed', 'suspended',
  ])
  status?: string;

  @ApiPropertyOptional({
    enum: ['created_at', 'current_amount', 'goal_amount', 'end_date', 'title'],
    default: 'created_at',
    description: 'Campo de ordenamiento',
  })
  @IsOptional()
  @IsString()
  @IsIn(['created_at', 'current_amount', 'goal_amount', 'end_date', 'title'])
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Dirección de ordenamiento',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Buscar por título (parcial)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Creada desde (fecha ISO, ej. 2025-01-01)' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Creada hasta (fecha ISO, inclusive)' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'Fin de campaña desde (fecha ISO)' })
  @IsOptional()
  @IsDateString()
  endDateFrom?: string;

  @ApiPropertyOptional({ description: 'Fin de campaña hasta (fecha ISO, inclusive)' })
  @IsOptional()
  @IsDateString()
  endDateTo?: string;
}
