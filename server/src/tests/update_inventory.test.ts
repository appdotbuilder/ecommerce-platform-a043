import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateInventoryInput, type CreateProductInput } from '../schema';
import { updateInventory } from '../handlers/update_inventory';
import { eq } from 'drizzle-orm';

// Test product data
const testProduct: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing inventory',
  type: 'physical',
  price: 29.99,
  stock_quantity: 100
};

describe('updateInventory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should increase inventory when quantity_change is positive', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: 50
    };

    const result = await updateInventory(input);

    expect(result.id).toEqual(productId);
    expect(result.stock_quantity).toEqual(150); // 100 + 50
    expect(result.name).toEqual(testProduct.name);
    expect(result.price).toEqual(29.99);
    expect(typeof result.price).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should decrease inventory when quantity_change is negative', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: -30
    };

    const result = await updateInventory(input);

    expect(result.id).toEqual(productId);
    expect(result.stock_quantity).toEqual(70); // 100 - 30
    expect(result.name).toEqual(testProduct.name);
    expect(result.price).toEqual(29.99);
    expect(typeof result.price).toBe('number');
  });

  it('should allow reducing inventory to zero', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: -100 // Reduce to exactly zero
    };

    const result = await updateInventory(input);

    expect(result.id).toEqual(productId);
    expect(result.stock_quantity).toEqual(0);
    expect(result.name).toEqual(testProduct.name);
  });

  it('should prevent negative inventory', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: -150 // More than current stock
    };

    await expect(updateInventory(input)).rejects.toThrow(/insufficient inventory/i);
  });

  it('should throw error when product does not exist', async () => {
    const input: UpdateInventoryInput = {
      product_id: 99999, // Non-existent product
      quantity_change: 10
    };

    await expect(updateInventory(input)).rejects.toThrow(/product.*not found/i);
  });

  it('should update database record correctly', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;
    const originalUpdatedAt = productResult[0].updated_at;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: 25
    };

    await updateInventory(input);

    // Verify database was updated
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].stock_quantity).toEqual(125); // 100 + 25
    expect(updatedProducts[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    expect(parseFloat(updatedProducts[0].price)).toEqual(29.99);
  });

  it('should handle zero quantity change', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: 0
    };

    const result = await updateInventory(input);

    expect(result.id).toEqual(productId);
    expect(result.stock_quantity).toEqual(100); // Should remain unchanged
    expect(result.name).toEqual(testProduct.name);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should work with products that have zero initial stock', async () => {
    // Create test product with zero stock
    const productResult = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        type: testProduct.type,
        price: testProduct.price.toString(),
        stock_quantity: 0 // Start with zero stock
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    const input: UpdateInventoryInput = {
      product_id: productId,
      quantity_change: 75
    };

    const result = await updateInventory(input);

    expect(result.id).toEqual(productId);
    expect(result.stock_quantity).toEqual(75);
    expect(result.name).toEqual(testProduct.name);
  });
});