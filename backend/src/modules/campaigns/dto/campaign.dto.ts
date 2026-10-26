import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum, IsUUID, IsDateString, Matches, IsArray, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsAfterDate } from '../../../common/decorators/is-after-date.decorator';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) return undefined;
  return value;
}

export class CreateRewardTierDto {
  @ApiProperty({ example: 'Basic Supporter' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Get early access to our newsletter' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPercentage?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPercentage?: number;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'Eco-friendly Water Bottles' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'We are creating the most sustainable water bottle.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Sustainable bottles' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-category',
    description: 'Si se omite, se asigna la primera categoría disponible en BD.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: ['uuid-of-category-1', 'uuid-of-category-2'],
    description: 'Array de categorías. Si se proporciona, se usa la primera.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  categoryIds?: string[];

  @ApiProperty({ example: 10000 })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto objetivo (goalAmount) debe ser numérico' })
  @Min(100, { message: 'El monto mínimo de recaudación es de 100' })
  goalAmount: number;


  /** @IsOptional debe ir antes de @IsDateString; si no, `undefined` falla validación y devuelve 400. */
  @ApiPropertyOptional({ example: '2024-12-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate debe tener un formato de fecha válido (ISO 8601)' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'endDate debe tener un formato de fecha válido (ISO 8601)' })
  @IsAfterDate('startDate', { message: 'La fecha de cierre debe ser estrictamente posterior a la fecha de inicio' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/(youtube\.com|youtu\.be|tiktok\.com)/, {
    message: 'El video debe ser un enlace válido de YouTube o TikTok',
  })
  videoUrl?: string;

  @ApiPropertyOptional({ type: [CreateRewardTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRewardTierDto)
  rewards?: CreateRewardTierDto[];
}

export class QueryCampaignsDto {
  @ApiPropertyOptional()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  categoryId?: string;
}
