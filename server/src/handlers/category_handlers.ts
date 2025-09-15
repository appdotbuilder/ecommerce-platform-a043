import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq, sql } from 'drizzle-orm';

export const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
  try {
    // Verify parent category exists if parent_id is provided
    if (input.parent_id) {
      const parentCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.parent_id))
        .execute();
      
      if (parentCategory.length === 0) {
        throw new Error(`Parent category with id ${input.parent_id} does not exist`);
      }
    }

    // Insert category record
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description,
        parent_id: input.parent_id,
        sort_order: input.sort_order
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
};

export const updateCategory = async (input: UpdateCategoryInput): Promise<Category> => {
  try {
    // Verify category exists
    const existingCategory = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.id))
      .execute();
    
    if (existingCategory.length === 0) {
      throw new Error(`Category with id ${input.id} does not exist`);
    }

    // Verify parent category exists if parent_id is provided
    if (input.parent_id) {
      const parentCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.parent_id))
        .execute();
      
      if (parentCategory.length === 0) {
        throw new Error(`Parent category with id ${input.parent_id} does not exist`);
      }

      // Prevent circular reference (category cannot be its own parent)
      if (input.parent_id === input.id) {
        throw new Error('Category cannot be its own parent');
      }
    }

    // Build update values only for provided fields
    const updateValues: any = {
      updated_at: sql`now()`
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.parent_id !== undefined) updateValues.parent_id = input.parent_id;
    if (input.sort_order !== undefined) updateValues.sort_order = input.sort_order;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    // Update category record
    const result = await db.update(categoriesTable)
      .set(updateValues)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .orderBy(categoriesTable.sort_order, categoriesTable.name)
      .execute();

    return result;
  } catch (error) {
    console.error('Fetching categories failed:', error);
    throw error;
  }
};

export const getCategoryById = async (id: number): Promise<Category | null> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Fetching category by id failed:', error);
    throw error;
  }
};

export const deleteCategory = async (id: number): Promise<boolean> => {
  try {
    // Check if category exists
    const category = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();
    
    if (category.length === 0) {
      throw new Error(`Category with id ${id} does not exist`);
    }

    // Check if category has any products assigned
    const productsWithCategory = await db.select()
      .from(productsTable)
      .where(eq(productsTable.category_id, id))
      .execute();
    
    if (productsWithCategory.length > 0) {
      throw new Error(`Cannot delete category with assigned products`);
    }

    // Check if category has child categories
    const childCategories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.parent_id, id))
      .execute();
    
    if (childCategories.length > 0) {
      throw new Error(`Cannot delete category with child categories`);
    }

    // Delete the category
    const result = await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
};