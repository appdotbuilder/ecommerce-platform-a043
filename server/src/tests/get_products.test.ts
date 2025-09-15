import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { getProducts, type GetProductsFilters } from '../handlers/get_products';

// Test product inputs
const physicalProduct: CreateProductInput = {
  name: 'Physical Product',
  description: 'A physical test product',
  type: 'physical',
  price: 29.99,
  stock_quantity: 50
};

const virtualProduct: CreateProductInput = {
  name: 'Virtual Product',
  description: 'A virtual test product',
  type: 'virtual',
  price: 19.99,
  stock_quantity: 100
};

const disabledProduct: CreateProductInput = {
  name: 'Disabled Product',
  description: 'A disabled test product',
  type: 'physical',
  price: 39.99,
  stock_quantity: 25
};

describe('getProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all products when no filters applied', async () => {
    // Create test products
    await db.insert(productsTable).values([
      {
        ...physicalProduct,
        price: physicalProduct.price.toString()
      },
      {
        ...virtualProduct,
        price: virtualProduct.price.toString()
      }
    ]).execute();

    const result = await getProducts();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Physical Product');
    expect(result[0].type).toEqual('physical');
    expect(result[0].price).toEqual(29.99);
    expect(typeof result[0].price).toEqual('number');
    expect(result[0].is_enabled).toBe(true);
    expect(result[0].created_at).toBeInstanceOf(Date);
    
    expect(result[1].name).toEqual('Virtual Product');
    expect(result[1].type).toEqual('virtual');
    expect(result[1].price).toEqual(19.99);
    expect(typeof result[1].price).toEqual('number');
  });

  it('should return empty array when no products exist', async () => {
    const result = await getProducts();
    expect(result).toHaveLength(0);
  });

  it('should filter products by enabled status', async () => {
    // Create enabled and disabled products
    await db.insert(productsTable).values([
      {
        ...physicalProduct,
        price: physicalProduct.price.toString()
      },
      {
        ...disabledProduct,
        price: disabledProduct.price.toString(),
        is_enabled: false
      }
    ]).execute();

    // Test filtering for enabled products
    const enabledProducts = await getProducts({ is_enabled: true });
    expect(enabledProducts).toHaveLength(1);
    expect(enabledProducts[0].name).toEqual('Physical Product');
    expect(enabledProducts[0].is_enabled).toBe(true);

    // Test filtering for disabled products
    const disabledProducts = await getProducts({ is_enabled: false });
    expect(disabledProducts).toHaveLength(1);
    expect(disabledProducts[0].name).toEqual('Disabled Product');
    expect(disabledProducts[0].is_enabled).toBe(false);
  });

  it('should filter products by type', async () => {
    // Create products of different types
    await db.insert(productsTable).values([
      {
        ...physicalProduct,
        price: physicalProduct.price.toString()
      },
      {
        ...virtualProduct,
        price: virtualProduct.price.toString()
      }
    ]).execute();

    // Test filtering for physical products
    const physicalProducts = await getProducts({ type: 'physical' });
    expect(physicalProducts).toHaveLength(1);
    expect(physicalProducts[0].name).toEqual('Physical Product');
    expect(physicalProducts[0].type).toEqual('physical');

    // Test filtering for virtual products
    const virtualProducts = await getProducts({ type: 'virtual' });
    expect(virtualProducts).toHaveLength(1);
    expect(virtualProducts[0].name).toEqual('Virtual Product');
    expect(virtualProducts[0].type).toEqual('virtual');
  });

  it('should apply multiple filters simultaneously', async () => {
    // Create products with different combinations
    await db.insert(productsTable).values([
      {
        ...physicalProduct,
        price: physicalProduct.price.toString()
      },
      {
        ...virtualProduct,
        price: virtualProduct.price.toString()
      },
      {
        name: 'Disabled Physical Product',
        description: 'A disabled physical product',
        type: 'physical',
        price: '49.99',
        stock_quantity: 10,
        is_enabled: false
      }
    ]).execute();

    // Test filtering for enabled physical products only
    const filters: GetProductsFilters = {
      is_enabled: true,
      type: 'physical'
    };

    const filteredProducts = await getProducts(filters);
    expect(filteredProducts).toHaveLength(1);
    expect(filteredProducts[0].name).toEqual('Physical Product');
    expect(filteredProducts[0].type).toEqual('physical');
    expect(filteredProducts[0].is_enabled).toBe(true);

    // Test filtering for disabled physical products
    const disabledPhysicalProducts = await getProducts({
      is_enabled: false,
      type: 'physical'
    });
    expect(disabledPhysicalProducts).toHaveLength(1);
    expect(disabledPhysicalProducts[0].name).toEqual('Disabled Physical Product');
    expect(disabledPhysicalProducts[0].is_enabled).toBe(false);
  });

  it('should handle numeric price conversion correctly', async () => {
    const productWithDecimalPrice = {
      name: 'Decimal Price Product',
      description: 'Product with precise decimal price',
      type: 'physical' as const,
      price: '123.45',
      stock_quantity: 15
    };

    await db.insert(productsTable).values(productWithDecimalPrice).execute();

    const result = await getProducts();
    expect(result).toHaveLength(1);
    expect(result[0].price).toEqual(123.45);
    expect(typeof result[0].price).toEqual('number');
  });

  it('should preserve all product fields in response', async () => {
    await db.insert(productsTable).values({
      ...physicalProduct,
      price: physicalProduct.price.toString()
    }).execute();

    const result = await getProducts();
    const product = result[0];

    // Verify all required fields are present
    expect(product.id).toBeDefined();
    expect(product.name).toEqual('Physical Product');
    expect(product.description).toEqual('A physical test product');
    expect(product.type).toEqual('physical');
    expect(product.price).toEqual(29.99);
    expect(product.stock_quantity).toEqual(50);
    expect(product.is_enabled).toBe(true);
    expect(product.created_at).toBeInstanceOf(Date);
    expect(product.updated_at).toBeInstanceOf(Date);
  });
});