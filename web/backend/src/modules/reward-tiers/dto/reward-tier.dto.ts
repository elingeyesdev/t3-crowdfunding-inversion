import { IsString, IsNumber, IsOptional, IsUUID, IsBoolean, IsArray, IsPositive, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRewardTierDto {
  @ApiProperty({ example: 'Bronce' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Acceso anticipado y agradecimiento' })
  @IsString()
  description: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 0.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage: number;

  @ApiPropertyOptional({ example: 'BOB' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 100, description: 'Número máximo de reclamos permitidos' })
  @IsNumber()
  @Min(1)
  maxClaims: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  includesShipping?: boolean;

  @ApiPropertyOptional({ example: 'Envío internacional incluido' })
  @IsOptional()
  @IsString()
  shippingDetails?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: [{ item: 'Sticker', qty: 1 }] })
  @IsOptional()
  @IsArray()
  items?: any[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateRewardTierDto extends CreateRewardTierDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRewardClaimDto {
  @ApiPropertyOptional({ example: 'shipped' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '1Z9999999999999999' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ example: 'https://ups.com/track?num=1Z9999999999999999' })
  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @ApiPropertyOptional({ example: 'Enviado por UPS.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
