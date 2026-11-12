import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta paginada estándar del API.
 */
export class PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    const totalPages = Math.ceil(total / limit);
    this.meta = {
      totalItems: total,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

export class PaginationMeta {
  @ApiProperty({ example: 50 })
  totalItems: number;

  @ApiProperty({ example: 10 })
  itemCount: number;

  @ApiProperty({ example: 10 })
  itemsPerPage: number;

  @ApiProperty({ example: 5 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}

/**
 * Respuesta estándar de éxito del API.
 */
export class ApiSuccessResponse<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional({ example: 'Operación completada' })
  message?: string;

  constructor(data?: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
  }
}
