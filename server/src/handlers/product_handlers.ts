import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type GetProductsInput, type Product } from '../schema';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';

export const createProduct = async (input: CreateProductInput): Promise<Product> => {
  try {
    // Verify category exists
    const category = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (category.length === 0) {
      throw new Error('Category not found');
    }

    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        short_description: input.short_description,
        price: input.price.toString(),
        original_price: input.original_price?.toString(),
        category_id: input.category_id,
        product_type: input.product_type,
        stock_quantity: input.stock_quantity,
        sku: input.sku,
        images: input.images,
        weight: input.weight?.toString(),
        dimensions: input.dimensions
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
};

export const updateProduct = async (input: UpdateProductInput): Promise<Product> => {
  try {
    // Verify product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // If category_id is being updated, verify it exists
    if (input.category_id !== undefined) {
      const category = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (category.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Build update object with proper type conversions
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.short_description !== undefined) updateData.short_description = input.short_description;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.original_price !== undefined) updateData.original_price = input.original_price?.toString();
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.is_featured !== undefined) updateData.is_featured = input.is_featured;
    if (input.weight !== undefined) updateData.weight = input.weight?.toString();
    if (input.dimensions !== undefined) updateData.dimensions = input.dimensions;
    updateData.updated_at = new Date();

    // Update product record
    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
};

export const getProducts = async (input: GetProductsInput): Promise<{ products: Product[]; total: number; page: number; limit: number }> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (input.category_id !== undefined) {
      conditions.push(eq(productsTable.category_id, input.category_id));
    }

    if (input.is_active !== undefined) {
      conditions.push(eq(productsTable.is_active, input.is_active));
    }

    if (input.is_featured !== undefined) {
      conditions.push(eq(productsTable.is_featured, input.is_featured));
    }

    if (input.product_type !== undefined) {
      conditions.push(eq(productsTable.product_type, input.product_type));
    }

    if (input.search) {
      conditions.push(
        or(
          ilike(productsTable.name, `%${input.search}%`),
          ilike(productsTable.description, `%${input.search}%`),
          ilike(productsTable.sku, `%${input.search}%`)
        )!
      );
    }

    // Build main query conditionally
    const offset = (input.page - 1) * input.limit;
    
    const results = conditions.length > 0
      ? await db.select()
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(productsTable.created_at))
          .limit(input.limit)
          .offset(offset)
          .execute()
      : await db.select()
          .from(productsTable)
          .orderBy(desc(productsTable.created_at))
          .limit(input.limit)
          .offset(offset)
          .execute();

    // Get total count with same conditions
    const totalResult = conditions.length > 0
      ? await db.select({ count: count() })
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select({ count: count() })
          .from(productsTable)
          .execute();
    
    const total = totalResult[0].count;

    // Convert numeric fields back to numbers
    const products = results.map(product => ({
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    }));

    return {
      products,
      total,
      page: input.page,
      limit: input.limit
    };
  } catch (error) {
    console.error('Products fetch failed:', error);
    throw error;
  }
};

export const getProductById = async (id: number): Promise<Product | null> => {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    };
  } catch (error) {
    console.error('Product fetch failed:', error);
    throw error;
  }
};

export const toggleProductStatus = async (id: number): Promise<Product> => {
  try {
    // Get current product
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // Toggle the is_active status
    const newStatus = !existingProduct[0].is_active;

    // Update product record
    const result = await db.update(productsTable)
      .set({
        is_active: newStatus,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    };
  } catch (error) {
    console.error('Product status toggle failed:', error);
    throw error;
  }
};

export const updateProductStock = async (productId: number, quantity: number): Promise<Product> => {
  try {
    // Verify product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // Update product stock
    const result = await db.update(productsTable)
      .set({
        stock_quantity: quantity,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, productId))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null
    };
  } catch (error) {
    console.error('Product stock update failed:', error);
    throw error;
  }
};