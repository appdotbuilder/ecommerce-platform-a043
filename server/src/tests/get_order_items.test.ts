import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable } from '../db/schema';
import { getOrderItems } from '../handlers/get_order_items';

describe('getOrderItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return order items for a valid order', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    // Create test products
    const productResults = await db.insert(productsTable)
      .values([
        {
          name: 'Product 1',
          description: 'First test product',
          type: 'physical',
          price: '29.99',
          stock_quantity: 100
        },
        {
          name: 'Product 2',
          description: 'Second test product',
          type: 'virtual',
          price: '49.99',
          stock_quantity: 50
        }
      ])
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        status: 'pending',
        total_amount: '109.97'
      })
      .returning()
      .execute();

    // Create order items
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: orderResult[0].id,
          product_id: productResults[0].id,
          quantity: 2,
          unit_price: '29.99',
          total_price: '59.98'
        },
        {
          order_id: orderResult[0].id,
          product_id: productResults[1].id,
          quantity: 1,
          unit_price: '49.99',
          total_price: '49.99'
        }
      ])
      .execute();

    // Test the handler
    const result = await getOrderItems(orderResult[0].id);

    expect(result).toHaveLength(2);
    
    // Verify first item
    expect(result[0].order_id).toEqual(orderResult[0].id);
    expect(result[0].product_id).toEqual(productResults[0].id);
    expect(result[0].quantity).toEqual(2);
    expect(result[0].unit_price).toEqual(29.99);
    expect(result[0].total_price).toEqual(59.98);
    expect(typeof result[0].unit_price).toBe('number');
    expect(typeof result[0].total_price).toBe('number');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify second item
    expect(result[1].order_id).toEqual(orderResult[0].id);
    expect(result[1].product_id).toEqual(productResults[1].id);
    expect(result[1].quantity).toEqual(1);
    expect(result[1].unit_price).toEqual(49.99);
    expect(result[1].total_price).toEqual(49.99);
    expect(typeof result[1].unit_price).toBe('number');
    expect(typeof result[1].total_price).toBe('number');
  });

  it('should return empty array for non-existent order', async () => {
    const result = await getOrderItems(999999);
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for order with no items', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    // Create order without any items
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        status: 'pending',
        total_amount: '0.00'
      })
      .returning()
      .execute();

    const result = await getOrderItems(orderResult[0].id);
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle orders with single item correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Single Product',
        description: 'Only product in order',
        type: 'physical',
        price: '15.50',
        stock_quantity: 10
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        status: 'processing',
        total_amount: '46.50'
      })
      .returning()
      .execute();

    // Create single order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderResult[0].id,
        product_id: productResult[0].id,
        quantity: 3,
        unit_price: '15.50',
        total_price: '46.50'
      })
      .execute();

    const result = await getOrderItems(orderResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toEqual(3);
    expect(result[0].unit_price).toEqual(15.50);
    expect(result[0].total_price).toEqual(46.50);
    expect(result[0].product_id).toEqual(productResult[0].id);
  });

  it('should handle decimal prices correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    // Create test product with decimal price
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Decimal Product',
        description: 'Product with decimal pricing',
        type: 'virtual',
        price: '123.45',
        stock_quantity: 25
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        status: 'delivered',
        total_amount: '246.90'
      })
      .returning()
      .execute();

    // Create order item with decimal calculations
    await db.insert(orderItemsTable)
      .values({
        order_id: orderResult[0].id,
        product_id: productResult[0].id,
        quantity: 2,
        unit_price: '123.45',
        total_price: '246.90'
      })
      .execute();

    const result = await getOrderItems(orderResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].unit_price).toEqual(123.45);
    expect(result[0].total_price).toEqual(246.90);
    expect(typeof result[0].unit_price).toBe('number');
    expect(typeof result[0].total_price).toBe('number');
  });
});