import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../config/database.module';

export interface BaseQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

@Injectable()
export abstract class BaseRepository {
  constructor(
    @Inject(DATABASE_POOL) protected readonly pool: Pool,
  ) {}

  protected normalizeSql(sql: string): string {
    let transformed = sql;
    if (/insert\s+ignore\s+into/i.test(transformed)) {
      transformed = transformed.replace(/insert\s+ignore\s+into/gi, 'INSERT INTO');
      if (!/on\s+conflict/i.test(transformed)) {
        transformed = `${transformed} ON CONFLICT DO NOTHING`;
      }
    }
    if (/group_concat/i.test(transformed)) {
      transformed = transformed.replace(
        /group_concat\s*\(\s*(distinct\s+)?([^,]+?)\s+separator\s+(['"][^'"]*['"])\s*\)/gi,
        'STRING_AGG($1$2, $3)',
      );
    }
    if (transformed.includes('?')) {
      let paramIndex = 1;
      transformed = transformed.replace(/\?/g, () => `$${paramIndex++}`);
    }
    return transformed;
  }

  /**
   * Ejecuta un query con parámetros y retorna resultado compatible con pg.
   */
  protected async query<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const normalized = this.normalizeSql(sql);
      return await client.query<T>(normalized, params || []);
    } finally {
      client.release();
    }
  }

  /**
   * Ejecuta un query y retorna la primera fila o null.
   */
  protected async queryOne<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  /**
   * Ejecuta un query y retorna todas las filas.
   */
  protected async queryMany<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Ejecuta múltiples queries dentro de una transacción.
   * Proporciona un cliente adaptado con métodos compatibles.
   */
  protected async transaction<T>(
    callback: (client: any) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const adaptedClient = {
        query: async (sql: string, params?: any[]) => {
          const normalized = this.normalizeSql(sql);
          return await client.query(normalized, params || []);
        },
        release: () => {},
      };

      const result = await callback(adaptedClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper para generar SET clause dinámicamente para UPDATE queries.
   */
  protected buildUpdateSet(
    data: Record<string, any>,
  ): { clause: string; values: any[] } {
    const entries = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    );

    const setClauses = entries.map(
      ([key]) => `${this.toSnakeCase(key)} = ?`,
    );

    return {
      clause: setClauses.join(', '),
      values: entries.map(([, value]) => value),
    };
  }

  /**
   * Convierte camelCase a snake_case para nombres de columna.
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
