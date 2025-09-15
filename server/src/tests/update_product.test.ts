import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput, type CreateProductInput } from '../schema';
import { updateProduct } from '../handlers/update_product';
import { eq } from 'drizzle-orm';

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test product
  const createTestProduct = async (): Promise<number> => {
    const testProductData: CreateProductInput = {
      name: 'Original Product',
      description: 'Original description',
      type: 'physical',
      price: 29.99,
      stock_quantity: 50
    };

    const result = await db.insert(productsTable)
      .values({
        name: testProductData.name,
        description: testProductData.description,
        type: testProductData.type,
        price: testProductData.price.toString(),
        stock_quantity: testProductData.stock_quantity
      })
      .returning()
      .execute();

    return result[0].id;
  };

  it('should update all product fields when provided', async () => {
    const productId = await createTestProduct();

    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Updated Product Name',
      description: 'Updated description',
      price: 39.99,
      stock_quantity: 75,
      is_enabled: false
    };

    const result = await updateProduct(updateInput);

    // Verify all fields were updated
    expect(result.id).toEqual(productId);
    expect(result.name).toEqual('Updated Product Name');
    expect(result.description).toEqual('Updated description');
    expect(result.price).toEqual(39.99);
    expect(typeof result.price).toEqual('number');
    expect(result.stock_quantity).toEqual(75);
    expect(result.is_enabled).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const productId = await createTestProduct();

    // Update only name and price
    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Partially Updated Product',
      price: 49.99
    };

    const result = await updateProduct(updateInput);

    // Verify only specified fields were updated
    expect(result.name).toEqual('Partially Updated Product');
    expect(result.price).toEqual(49.99);
    
    // Verify other fields remain unchanged
    expect(result.description).toEqual('Original description');
    expect(result.stock_quantity).toEqual(50);
    expect(result.is_enabled).toEqual(true); // Default value
  });

  it('should update product description to null', async () => {
    const productId = await createTestProduct();

    const updateInput: UpdateProductInput = {
      id: productId,
      description: null
    };

    const result = await updateProduct(updateInput);

    expect(result.description).toBeNull();
    expect(result.name).toEqual('Original Product'); // Unchanged
  });

  it('should update is_enabled status', async () => {
    const productId = await createTestProduct();

    // First, disable the product
    const disableInput: UpdateProductInput = {
      id: productId,
      is_enabled: false
    };

    const disabledResult = await updateProduct(disableInput);
    expect(disabledResult.is_enabled).toEqual(false);

    // Then, enable it again
    const enableInput: UpdateProductInput = {
      id: productId,
      is_enabled: true
    };

    const enabledResult = await updateProduct(enableInput);
    expect(enabledResult.is_enabled).toEqual(true);
  });

  it('should persist changes to database', async () => {
    const productId = await createTestProduct();

    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Database Updated Product',
      price: 99.99,
      stock_quantity: 25
    };

    await updateProduct(updateInput);

    // Verify changes were persisted to database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    const product = products[0];
    expect(product.name).toEqual('Database Updated Product');
    expect(parseFloat(product.price)).toEqual(99.99);
    expect(product.stock_quantity).toEqual(25);
    expect(product.updated_at).toBeInstanceOf(Date);
  });

  it('should update stock quantity to zero', async () => {
    const productId = await createTestProduct();

    const updateInput: UpdateProductInput = {
      id: productId,
      stock_quantity: 0
    };

    const result = await updateProduct(updateInput);

    expect(result.stock_quantity).toEqual(0);
    expect(result.name).toEqual('Original Product'); // Unchanged
  });

  it('should throw error when product does not exist', async () => {
    const nonExistentId = 999999;

    const updateInput: UpdateProductInput = {
      id: nonExistentId,
      name: 'This should fail'
    };

    await expect(updateProduct(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should update updated_at timestamp automatically', async () => {
    const productId = await createTestProduct();

    // Get original timestamp
    const originalProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    const originalUpdatedAt = originalProducts[0].updated_at;

    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Timestamp Test Product'
    };

    const result = await updateProduct(updateInput);

    // Verify updated_at was changed
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should handle price with decimal places correctly', async () => {
    const productId = await createTestProduct();

    const updateInput: UpdateProductInput = {
      id: productId,
      price: 123.45 // Test with 2 decimal places (matches numeric(10,2) precision)
    };

    const result = await updateProduct(updateInput);

    expect(typeof result.price).toEqual('number');
    expect(result.price).toEqual(123.45);

    // Verify in database (PostgreSQL numeric(10,2) has 2 decimal precision)
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(parseFloat(products[0].price)).toEqual(123.45);
  });
});