import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignUpdateDto {
  @ApiProperty({ example: 'Novedad de campaña' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Detalle sobre el avance del proyecto...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  attachments?: any[];
}
