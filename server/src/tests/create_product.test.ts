import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { createProduct } from '../handlers/create_product';
import { eq } from 'drizzle-orm';

// Test inputs for different product types
const physicalProductInput: CreateProductInput = {
  name: 'Physical Test Product',
  description: 'A physical product for testing',
  type: 'physical',
  price: 19.99,
  stock_quantity: 100
};

const virtualProductInput: CreateProductInput = {
  name: 'Virtual Test Product',
  description: 'A virtual product for testing',
  type: 'virtual',
  price: 9.99,
  stock_quantity: 1000
};

const minimalProductInput: CreateProductInput = {
  name: 'Minimal Product',
  type: 'physical',
  price: 5.00,
  stock_quantity: 50
  // description is optional
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a physical product with all fields', async () => {
    const result = await createProduct(physicalProductInput);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Physical Test Product');
    expect(result.description).toEqual('A physical product for testing');
    expect(result.type).toEqual('physical');
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toEqual('number');
    expect(result.stock_quantity).toEqual(100);
    expect(result.is_enabled).toEqual(true); // Default value
    expect(result.id).toBeDefined();
    expect(typeof result.id).toEqual('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a virtual product', async () => {
    const result = await createProduct(virtualProductInput);

    expect(result.name).toEqual('Virtual Test Product');
    expect(result.type).toEqual('virtual');
    expect(result.price).toEqual(9.99);
    expect(result.stock_quantity).toEqual(1000);
    expect(result.is_enabled).toEqual(true);
  });

  it('should create a product with minimal fields (no description)', async () => {
    const result = await createProduct(minimalProductInput);

    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toBeNull();
    expect(result.type).toEqual('physical');
    expect(result.price).toEqual(5.00);
    expect(result.stock_quantity).toEqual(50);
    expect(result.is_enabled).toEqual(true);
  });

  it('should save product to database correctly', async () => {
    const result = await createProduct(physicalProductInput);

    // Query database to verify persistence
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    const savedProduct = products[0];
    
    expect(savedProduct.name).toEqual('Physical Test Product');
    expect(savedProduct.description).toEqual('A physical product for testing');
    expect(savedProduct.type).toEqual('physical');
    expect(parseFloat(savedProduct.price)).toEqual(19.99); // Database stores as string
    expect(savedProduct.stock_quantity).toEqual(100);
    expect(savedProduct.is_enabled).toEqual(true);
    expect(savedProduct.created_at).toBeInstanceOf(Date);
    expect(savedProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal prices correctly', async () => {
    const decimalInput: CreateProductInput = {
      name: 'Decimal Price Product',
      type: 'physical',
      price: 123.456, // Will be rounded to 2 decimal places by numeric(10,2)
      stock_quantity: 10
    };

    const result = await createProduct(decimalInput);

    expect(result.price).toEqual(123.46); // Rounded to 2 decimal places
    expect(typeof result.price).toEqual('number');

    // Verify database storage
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(parseFloat(products[0].price)).toEqual(123.46);
  });

  it('should create products with zero stock quantity', async () => {
    const zeroStockInput: CreateProductInput = {
      name: 'Zero Stock Product',
      type: 'virtual',
      price: 15.99,
      stock_quantity: 0
    };

    const result = await createProduct(zeroStockInput);

    expect(result.stock_quantity).toEqual(0);
    expect(result.name).toEqual('Zero Stock Product');
  });

  it('should create multiple products with different names', async () => {
    const product1 = await createProduct({
      name: 'Product One',
      type: 'physical',
      price: 10.00,
      stock_quantity: 5
    });

    const product2 = await createProduct({
      name: 'Product Two',
      type: 'virtual',
      price: 20.00,
      stock_quantity: 15
    });

    // Verify both products exist with different IDs
    expect(product1.id).not.toEqual(product2.id);
    expect(product1.name).toEqual('Product One');
    expect(product2.name).toEqual('Product Two');

    // Verify both are in database
    const allProducts = await db.select()
      .from(productsTable)
      .execute();

    expect(allProducts).toHaveLength(2);
    const names = allProducts.map(p => p.name);
    expect(names).toContain('Product One');
    expect(names).toContain('Product Two');
  });
});