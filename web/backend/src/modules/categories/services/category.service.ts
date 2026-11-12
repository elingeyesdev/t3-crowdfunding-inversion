import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../repositories';
import { Category } from '../models';

/**
 * Service: Categorías
 * Lógica de negocio para el catálogo de categorías.
 */
@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  /**
   * Retorna todas las categorías activas.
   * Usado por el frontend para el selector de intereses del inversor.
   */
  async findAll(): Promise<Category[]> {
    return this.categoryRepo.findAllActive();
  }
}
