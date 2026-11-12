import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { Category, mapRowToCategory } from '../models';

/**
 * Repository: Categorías
 * Solo lectura — las categorías son catálogo inmutable.
 */
@Injectable()
export class CategoryRepository extends BaseRepository {
  /**
   * Retorna todas las categorías activas ordenadas por sort_order.
   */
  async findAllActive(): Promise<Category[]> {
    const rows = await this.queryMany(
      `SELECT * FROM categories
       WHERE is_active = true
       ORDER BY sort_order ASC`,
      [],
    );
    return rows.map(mapRowToCategory);
  }

  /**
   * Retorna categorías por sus IDs (para validar preferencias del inversor).
   */
  async findByIds(ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await this.queryMany(
      `SELECT * FROM categories
       WHERE id IN (${placeholders}) AND is_active = true
       ORDER BY sort_order ASC`,
      ids,
    );
    return rows.map(mapRowToCategory);
  }
}
