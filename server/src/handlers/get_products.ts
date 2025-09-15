import { db } from '../db';
import { productsTable } from '../db/schema';
import { type Product } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export interface GetProductsFilters {
  is_enabled?: boolean;
  type?: 'physical' | 'virtual';
}

export const getProducts = async (filters?: GetProductsFilters): Promise<Product[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters?.is_enabled !== undefined) {
      conditions.push(eq(productsTable.is_enabled, filters.is_enabled));
    }

    if (filters?.type) {
      conditions.push(eq(productsTable.type, filters.type));
    }

    // Execute query with or without conditions
    const results = conditions.length > 0
      ? await db.select()
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(productsTable)
          .execute();

    // Convert numeric fields back to numbers
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
};