import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoryService } from '../services';
import { ApiSuccessResponse } from '../../../common/dto';
import { Category } from '../models';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * GET /categories
   * Retorna todas las categorías activas.
   * Endpoint público — no requiere autenticación.
   * Usado por el frontend para el selector de intereses del inversor.
   */
  @Get()
  @ApiOperation({ summary: 'Listar todas las categorías activas' })
  @ApiResponse({ status: 200, description: 'Lista de categorías retornada exitosamente.' })
  async findAll(): Promise<ApiSuccessResponse<Category[]>> {
    const categories = await this.categoryService.findAll();
    return new ApiSuccessResponse(categories);
  }
}
