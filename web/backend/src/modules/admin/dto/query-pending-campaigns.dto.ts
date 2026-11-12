import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum CampaignTypeFilter {
  ALL = 'all',
  DONATION = 'donation',
}

export class QueryPendingCampaignsDto {
  @ApiPropertyOptional({ description: 'Búsqueda por título o nombre del emprendedor' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CampaignTypeFilter, default: CampaignTypeFilter.ALL })
  @IsOptional()
  @IsEnum(CampaignTypeFilter)
  type?: CampaignTypeFilter = CampaignTypeFilter.ALL;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Campo por el cual ordenar', default: 'created_at' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ description: 'Dirección del orden', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';
}
