import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable, referralCommissionsTable } from '../db/schema';
import { getAllOrders } from '../handlers/get_all_orders';


describe('getAllOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no orders exist', async () => {
    const result = await getAllOrders();
    expect(result).toEqual([]);
  });

  it('should fetch all orders with proper type conversions', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A test product',
        type: 'physical',
        price: '99.99',
        stock_quantity: 10
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'pending',
        total_amount: '199.98',
        referral_fee_level_1: '10.00',
        referral_fee_level_2: '5.00',
        shipping_address: '123 Test St, Test City, TC 12345'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        quantity: 2,
        unit_price: '99.99',
        total_price: '199.98'
      })
      .execute();

    const result = await getAllOrders();

    expect(result).toHaveLength(1);
    
    const order = result[0];
    expect(order.id).toBe(orderId);
    expect(order.user_id).toBe(userId);
    expect(order.status).toBe('pending');
    expect(order.total_amount).toBe(199.98);
    expect(typeof order.total_amount).toBe('number');
    expect(order.referral_fee_level_1).toBe(10.00);
    expect(typeof order.referral_fee_level_1).toBe('number');
    expect(order.referral_fee_level_2).toBe(5.00);
    expect(typeof order.referral_fee_level_2).toBe('number');
    expect(order.shipping_address).toBe('123 Test St, Test City, TC 12345');
    expect(order.created_at).toBeInstanceOf(Date);
    expect(order.updated_at).toBeInstanceOf(Date);
  });

  it('should handle null referral fees correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test2@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User2',
        role: 'user'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create order without referral fees
    await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'delivered',
        total_amount: '49.99',
        shipping_address: null
      })
      .execute();

    const result = await getAllOrders();

    expect(result).toHaveLength(1);
    
    const order = result[0];
    expect(order.total_amount).toBe(49.99);
    expect(order.referral_fee_level_1).toBeNull();
    expect(order.referral_fee_level_2).toBeNull();
    expect(order.shipping_address).toBeNull();
  });

  it('should return orders sorted by created_at in descending order', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test3@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User3',
        role: 'user'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple orders with slight delays to ensure different timestamps
    const order1 = await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'pending',
        total_amount: '100.00'
      })
      .returning()
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const order2 = await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'processing',
        total_amount: '200.00'
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const order3 = await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'shipped',
        total_amount: '300.00'
      })
      .returning()
      .execute();

    const result = await getAllOrders();

    expect(result).toHaveLength(3);
    
    // Should be sorted by created_at descending (most recent first)
    expect(result[0].id).toBe(order3[0].id);
    expect(result[0].total_amount).toBe(300.00);
    expect(result[1].id).toBe(order2[0].id);
    expect(result[1].total_amount).toBe(200.00);
    expect(result[2].id).toBe(order1[0].id);
    expect(result[2].total_amount).toBe(100.00);
    
    // Verify timestamps are in descending order
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
    expect(result[1].created_at.getTime()).toBeGreaterThanOrEqual(result[2].created_at.getTime());
  });

  it('should fetch orders from multiple users', async () => {
    // Create multiple test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'One',
        role: 'user'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'Two',
        role: 'distributor'
      })
      .returning()
      .execute();

    // Create orders for both users
    await db.insert(ordersTable)
      .values({
        user_id: user1Result[0].id,
        status: 'pending',
        total_amount: '150.00'
      })
      .execute();

    await db.insert(ordersTable)
      .values({
        user_id: user2Result[0].id,
        status: 'delivered',
        total_amount: '250.00'
      })
      .execute();

    const result = await getAllOrders();

    expect(result).toHaveLength(2);
    
    // Check that we have orders from both users
    const userIds = result.map(order => order.user_id).sort();
    expect(userIds).toEqual([user1Result[0].id, user2Result[0].id].sort());
    
    // Verify total amounts
    const totalAmounts = result.map(order => order.total_amount).sort();
    expect(totalAmounts).toEqual([150.00, 250.00]);
  });

  it('should handle all order statuses correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'status@example.com',
        password_hash: 'hashed_password',
        first_name: 'Status',
        last_name: 'Test',
        role: 'user'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create orders with different statuses
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
    
    for (const status of statuses) {
      await db.insert(ordersTable)
        .values({
          user_id: userId,
          status: status,
          total_amount: '100.00'
        })
        .execute();
    }

    const result = await getAllOrders();

    expect(result).toHaveLength(5);
    
    // Check that all statuses are represented
    const returnedStatuses = result.map(order => order.status).sort();
    expect(returnedStatuses).toEqual(['cancelled', 'delivered', 'pending', 'processing', 'shipped']);
  });
});