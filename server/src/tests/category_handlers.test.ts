import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  updateCategory, 
  getCategories, 
  getCategoryById, 
  deleteCategory 
} from '../handlers/category_handlers';
import { eq } from 'drizzle-orm';

// Test input data
const testCategoryInput: CreateCategoryInput = {
  name: 'Electronics',
  description: 'Electronic devices and gadgets',
  parent_id: null,
  sort_order: 10
};

const testSubCategoryInput: CreateCategoryInput = {
  name: 'Smartphones',
  description: 'Mobile phones and accessories',
  parent_id: 1, // Will be updated with actual parent ID
  sort_order: 5
};

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a root category', async () => {
    const result = await createCategory(testCategoryInput);

    expect(result.name).toEqual('Electronics');
    expect(result.description).toEqual('Electronic devices and gadgets');
    expect(result.parent_id).toBeNull();
    expect(result.sort_order).toEqual(10);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a subcategory with valid parent', async () => {
    // Create parent category first
    const parentCategory = await createCategory(testCategoryInput);

    const subCategoryInput = {
      ...testSubCategoryInput,
      parent_id: parentCategory.id
    };

    const result = await createCategory(subCategoryInput);

    expect(result.name).toEqual('Smartphones');
    expect(result.description).toEqual('Mobile phones and accessories');
    expect(result.parent_id).toEqual(parentCategory.id);
    expect(result.sort_order).toEqual(5);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('should save category to database', async () => {
    const result = await createCategory(testCategoryInput);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Electronics');
    expect(categories[0].description).toEqual('Electronic devices and gadgets');
    expect(categories[0].sort_order).toEqual(10);
    expect(categories[0].is_active).toBe(true);
  });

  it('should reject invalid parent category id', async () => {
    const invalidInput = {
      ...testCategoryInput,
      parent_id: 999
    };

    expect(createCategory(invalidInput)).rejects.toThrow(/parent category.*does not exist/i);
  });

  it('should handle category with minimal data', async () => {
    const minimalInput: CreateCategoryInput = {
      name: 'Minimal Category',
      description: null,
      parent_id: null,
      sort_order: 0
    };

    const result = await createCategory(minimalInput);

    expect(result.name).toEqual('Minimal Category');
    expect(result.description).toBeNull();
    expect(result.parent_id).toBeNull();
    expect(result.sort_order).toEqual(0);
  });
});

describe('updateCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update category name and description', async () => {
    const category = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: category.id,
      name: 'Updated Electronics',
      description: 'Updated description for electronics'
    };

    const result = await updateCategory(updateInput);

    expect(result.name).toEqual('Updated Electronics');
    expect(result.description).toEqual('Updated description for electronics');
    expect(result.sort_order).toEqual(10); // Should remain unchanged
    expect(result.is_active).toBe(true);
    expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should update category parent and sort order', async () => {
    const parentCategory = await createCategory(testCategoryInput);
    const childCategory = await createCategory({
      name: 'Child Category',
      description: 'A child category',
      parent_id: null,
      sort_order: 0
    });

    const updateInput: UpdateCategoryInput = {
      id: childCategory.id,
      parent_id: parentCategory.id,
      sort_order: 15
    };

    const result = await updateCategory(updateInput);

    expect(result.parent_id).toEqual(parentCategory.id);
    expect(result.sort_order).toEqual(15);
    expect(result.name).toEqual('Child Category'); // Should remain unchanged
  });

  it('should update category active status', async () => {
    const category = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: category.id,
      is_active: false
    };

    const result = await updateCategory(updateInput);

    expect(result.is_active).toBe(false);
    expect(result.name).toEqual('Electronics'); // Should remain unchanged
  });

  it('should reject update with non-existent category id', async () => {
    const updateInput: UpdateCategoryInput = {
      id: 999,
      name: 'Non-existent'
    };

    expect(updateCategory(updateInput)).rejects.toThrow(/category.*does not exist/i);
  });

  it('should reject update with invalid parent category id', async () => {
    const category = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: category.id,
      parent_id: 999
    };

    expect(updateCategory(updateInput)).rejects.toThrow(/parent category.*does not exist/i);
  });

  it('should prevent circular reference (self as parent)', async () => {
    const category = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: category.id,
      parent_id: category.id
    };

    expect(updateCategory(updateInput)).rejects.toThrow(/cannot be its own parent/i);
  });
});

describe('getCategories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no categories exist', async () => {
    const result = await getCategories();

    expect(result).toEqual([]);
  });

  it('should return all categories', async () => {
    const category1 = await createCategory(testCategoryInput);
    const category2 = await createCategory({
      name: 'Clothing',
      description: 'Apparel and accessories',
      parent_id: null,
      sort_order: 5
    });

    const result = await getCategories();

    expect(result).toHaveLength(2);
    expect(result.map(c => c.name)).toContain('Electronics');
    expect(result.map(c => c.name)).toContain('Clothing');
  });

  it('should return categories ordered by sort_order and name', async () => {
    await createCategory({ ...testCategoryInput, sort_order: 20, name: 'Z-Category' });
    await createCategory({ ...testCategoryInput, sort_order: 10, name: 'A-Category' });
    await createCategory({ ...testCategoryInput, sort_order: 10, name: 'B-Category' });

    const result = await getCategories();

    expect(result).toHaveLength(3);
    // Should be ordered by sort_order first, then by name
    expect(result[0].sort_order).toEqual(10);
    expect(result[1].sort_order).toEqual(10);
    expect(result[2].sort_order).toEqual(20);
    expect(result[0].name).toEqual('A-Category');
    expect(result[1].name).toEqual('B-Category');
  });
});

describe('getCategoryById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return category by id', async () => {
    const category = await createCategory(testCategoryInput);

    const result = await getCategoryById(category.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(category.id);
    expect(result!.name).toEqual('Electronics');
    expect(result!.description).toEqual('Electronic devices and gadgets');
  });

  it('should return null for non-existent id', async () => {
    const result = await getCategoryById(999);

    expect(result).toBeNull();
  });

  it('should return category with all fields', async () => {
    const category = await createCategory(testCategoryInput);

    const result = await getCategoryById(category.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBeDefined();
    expect(result!.name).toBeDefined();
    expect(result!.description).toBeDefined();
    expect(result!.parent_id).toBeDefined();
    expect(result!.sort_order).toBeDefined();
    expect(result!.is_active).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });
});

describe('deleteCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete category successfully', async () => {
    const category = await createCategory(testCategoryInput);

    const result = await deleteCategory(category.id);

    expect(result).toBe(true);

    // Verify category is deleted
    const deletedCategory = await getCategoryById(category.id);
    expect(deletedCategory).toBeNull();
  });

  it('should reject deletion of non-existent category', async () => {
    expect(deleteCategory(999)).rejects.toThrow(/category.*does not exist/i);
  });

  it('should prevent deletion of category with assigned products', async () => {
    const category = await createCategory(testCategoryInput);

    // Create a product assigned to this category
    await db.insert(productsTable).values({
      name: 'Test Product',
      description: 'A test product',
      price: '19.99',
      category_id: category.id,
      product_type: 'physical',
      stock_quantity: 10,
      sku: 'TEST-001'
    }).execute();

    expect(deleteCategory(category.id)).rejects.toThrow(/cannot delete category with assigned products/i);
  });

  it('should prevent deletion of category with child categories', async () => {
    const parentCategory = await createCategory(testCategoryInput);
    await createCategory({
      name: 'Child Category',
      description: 'A child category',
      parent_id: parentCategory.id,
      sort_order: 0
    });

    expect(deleteCategory(parentCategory.id)).rejects.toThrow(/cannot delete category with child categories/i);
  });

  it('should allow deletion of childless category without products', async () => {
    const parentCategory = await createCategory(testCategoryInput);
    const childCategory = await createCategory({
      name: 'Child Category',
      description: 'A child category',
      parent_id: parentCategory.id,
      sort_order: 0
    });

    // Should be able to delete child category (no children, no products)
    const result = await deleteCategory(childCategory.id);
    expect(result).toBe(true);

    // Verify child category is deleted but parent remains
    const deletedChild = await getCategoryById(childCategory.id);
    const existingParent = await getCategoryById(parentCategory.id);
    expect(deletedChild).toBeNull();
    expect(existingParent).not.toBeNull();
  });
});