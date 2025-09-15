import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type GetProductsInput } from '../schema';
import { 
  createProduct, 
  updateProduct, 
  getProducts, 
  getProductById, 
  toggleProductStatus, 
  updateProductStock 
} from '../handlers/product_handlers';
import { eq, count } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Electronics',
  description: 'Electronic products',
  parent_id: null,
  sort_order: 1
};

const testProductInput: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing',
  short_description: 'Short desc',
  price: 29.99,
  original_price: 39.99,
  category_id: 1, // Will be set after category creation
  product_type: 'physical',
  stock_quantity: 50,
  sku: 'TEST-001',
  images: ['image1.jpg', 'image2.jpg'],
  weight: 1.5,
  dimensions: '10x10x5cm'
};

const createTestCategory = async () => {
  const result = await db.insert(categoriesTable)
    .values(testCategory)
    .returning()
    .execute();
  return result[0];
};

const createTestProduct = async (categoryId: number, overrides: Partial<CreateProductInput> = {}) => {
  // Generate unique SKU if not provided in overrides
  const uniqueSku = overrides.sku || `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  return await createProduct({
    ...testProductInput,
    category_id: categoryId,
    sku: uniqueSku,
    ...overrides
  });
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a product successfully', async () => {
    const category = await createTestCategory();
    
    const result = await createProduct({
      ...testProductInput,
      category_id: category.id
    });

    expect(result.id).toBeDefined();
    expect(result.name).toEqual('Test Product');
    expect(result.description).toEqual('A product for testing');
    expect(result.price).toEqual(29.99);
    expect(typeof result.price).toBe('number');
    expect(result.original_price).toEqual(39.99);
    expect(result.category_id).toEqual(category.id);
    expect(result.product_type).toEqual('physical');
    expect(result.stock_quantity).toEqual(50);
    expect(result.sku).toEqual('TEST-001');
    expect(result.images).toEqual(['image1.jpg', 'image2.jpg']);
    expect(result.is_active).toBe(true);
    expect(result.is_featured).toBe(false);
    expect(result.weight).toEqual(1.5);
    expect(result.dimensions).toEqual('10x10x5cm');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save product to database', async () => {
    const category = await createTestCategory();
    const result = await createProduct({
      ...testProductInput,
      category_id: category.id
    });

    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].name).toEqual('Test Product');
    expect(parseFloat(products[0].price)).toEqual(29.99);
  });

  it('should throw error if category does not exist', async () => {
    await expect(createProduct({
      ...testProductInput,
      category_id: 999
    })).rejects.toThrow(/Category not found/i);
  });

  it('should create product with minimal data', async () => {
    const category = await createTestCategory();
    
    const minimalInput: CreateProductInput = {
      name: 'Minimal Product',
      description: null,
      short_description: null,
      price: 10.99,
      original_price: null,
      category_id: category.id,
      product_type: 'virtual',
      stock_quantity: 0,
      sku: 'MIN-001',
      images: [],
      weight: null,
      dimensions: null
    };

    const result = await createProduct(minimalInput);

    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(10.99);
    expect(result.original_price).toBeNull();
    expect(result.product_type).toEqual('virtual');
    expect(result.weight).toBeNull();
  });
});

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update product successfully', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      name: 'Updated Product',
      price: 39.99,
      stock_quantity: 25,
      is_active: false
    };

    const result = await updateProduct(updateInput);

    expect(result.id).toEqual(product.id);
    expect(result.name).toEqual('Updated Product');
    expect(result.price).toEqual(39.99);
    expect(result.stock_quantity).toEqual(25);
    expect(result.is_active).toBe(false);
    expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should update only provided fields', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      price: 19.99
    };

    const result = await updateProduct(updateInput);

    expect(result.name).toEqual(product.name); // Should remain unchanged
    expect(result.price).toEqual(19.99); // Should be updated
    expect(result.stock_quantity).toEqual(product.stock_quantity); // Should remain unchanged
  });

  it('should throw error if product does not exist', async () => {
    await expect(updateProduct({
      id: 999,
      name: 'Non-existent'
    })).rejects.toThrow(/Product not found/i);
  });

  it('should throw error if new category does not exist', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);

    await expect(updateProduct({
      id: product.id,
      category_id: 999
    })).rejects.toThrow(/Category not found/i);
  });
});

describe('getProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return paginated products', async () => {
    const category = await createTestCategory();
    await createTestProduct(category.id, { name: 'Product 1', sku: 'SKU-001' });
    await createTestProduct(category.id, { name: 'Product 2', sku: 'SKU-002' });
    await createTestProduct(category.id, { name: 'Product 3', sku: 'SKU-003' });

    const input: GetProductsInput = {
      page: 1,
      limit: 2
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(2);
    expect(result.total).toEqual(3);
    expect(result.page).toEqual(1);
    expect(result.limit).toEqual(2);
    expect(typeof result.products[0].price).toBe('number');
  });

  it('should filter by category', async () => {
    const category1 = await createTestCategory();
    const category2 = await db.insert(categoriesTable)
      .values({ ...testCategory, name: 'Books' })
      .returning()
      .execute();

    await createTestProduct(category1.id, { name: 'Electronics Product', sku: 'ELEC-001' });
    await createTestProduct(category2[0].id, { name: 'Book Product', sku: 'BOOK-001' });

    const result = await getProducts({
      category_id: category1.id,
      page: 1,
      limit: 20
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toEqual('Electronics Product');
  });

  it('should filter by active status', async () => {
    const category = await createTestCategory();
    await createTestProduct(category.id, { name: 'Active Product', sku: 'ACT-001' });
    
    const inactiveProduct = await createTestProduct(category.id, { name: 'Inactive Product', sku: 'INACT-001' });
    await db.update(productsTable)
      .set({ is_active: false })
      .where(eq(productsTable.id, inactiveProduct.id))
      .execute();

    const result = await getProducts({
      is_active: true,
      page: 1,
      limit: 20
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toEqual('Active Product');
    expect(result.products[0].is_active).toBe(true);
  });

  it('should search products by name and description', async () => {
    const category = await createTestCategory();
    await createTestProduct(category.id, { 
      name: 'Smartphone', 
      description: 'Latest mobile device',
      sku: 'PHONE-001' 
    });
    await createTestProduct(category.id, { 
      name: 'Laptop', 
      description: 'High performance computer',
      sku: 'LAP-001' 
    });

    const result = await getProducts({
      search: 'mobile',
      page: 1,
      limit: 20
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toEqual('Smartphone');
  });

  it('should filter by product type', async () => {
    const category = await createTestCategory();
    await createTestProduct(category.id, { name: 'Physical Product', product_type: 'physical', sku: 'PHYS-001' });
    await createTestProduct(category.id, { name: 'Virtual Product', product_type: 'virtual', sku: 'VIRT-001' });

    const result = await getProducts({
      product_type: 'virtual',
      page: 1,
      limit: 20
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].product_type).toEqual('virtual');
  });

  it('should return empty results when no products match', async () => {
    const result = await getProducts({
      search: 'nonexistent',
      page: 1,
      limit: 20
    });

    expect(result.products).toHaveLength(0);
    expect(result.total).toEqual(0);
  });
});

describe('getProductById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return product by id', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);

    const result = await getProductById(product.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(product.id);
    expect(result!.name).toEqual('Test Product');
    expect(typeof result!.price).toBe('number');
  });

  it('should return null if product not found', async () => {
    const result = await getProductById(999);
    expect(result).toBeNull();
  });
});

describe('toggleProductStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should toggle product from active to inactive', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    
    expect(product.is_active).toBe(true);

    const result = await toggleProductStatus(product.id);

    expect(result.is_active).toBe(false);
    expect(result.updated_at.getTime()).toBeGreaterThan(product.updated_at.getTime());
  });

  it('should toggle product from inactive to active', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    
    // First toggle to inactive
    await toggleProductStatus(product.id);
    
    // Then toggle back to active
    const result = await toggleProductStatus(product.id);

    expect(result.is_active).toBe(true);
  });

  it('should throw error if product does not exist', async () => {
    await expect(toggleProductStatus(999)).rejects.toThrow(/Product not found/i);
  });
});

describe('updateProductStock', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update product stock quantity', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    
    expect(product.stock_quantity).toEqual(50);

    const result = await updateProductStock(product.id, 100);

    expect(result.stock_quantity).toEqual(100);
    expect(result.updated_at.getTime()).toBeGreaterThan(product.updated_at.getTime());
  });

  it('should update stock to zero', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);

    const result = await updateProductStock(product.id, 0);

    expect(result.stock_quantity).toEqual(0);
  });

  it('should throw error if product does not exist', async () => {
    await expect(updateProductStock(999, 100)).rejects.toThrow(/Product not found/i);
  });
});