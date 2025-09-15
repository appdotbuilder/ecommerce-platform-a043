import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ordersTable } from '../db/schema';
import { type GetUserOrdersInput } from '../schema';
import { getUserOrders } from '../handlers/get_user_orders';

// Test data
const testUser1 = {
  email: 'user1@example.com',
  password_hash: 'hashedpassword123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user' as const
};

const testUser2 = {
  email: 'user2@example.com',
  password_hash: 'hashedpassword456',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'user' as const
};

describe('getUserOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return orders for a specific user', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create orders for both users
    await db.insert(ordersTable)
      .values([
        {
          user_id: user1Id,
          status: 'pending',
          total_amount: '100.50',
          referral_fee_level_1: '5.00',
          shipping_address: '123 Main St'
        },
        {
          user_id: user1Id,
          status: 'delivered',
          total_amount: '75.25',
          referral_fee_level_2: '3.50'
        },
        {
          user_id: user2Id,
          status: 'shipped',
          total_amount: '200.00'
        }
      ])
      .execute();

    const input: GetUserOrdersInput = {
      user_id: user1Id
    };

    const result = await getUserOrders(input);

    // Should return only user1's orders
    expect(result).toHaveLength(2);
    
    // Check that all returned orders belong to user1
    result.forEach(order => {
      expect(order.user_id).toBe(user1Id);
    });

    // Verify numeric field conversions
    expect(typeof result[0].total_amount).toBe('number');
    expect(typeof result[0].referral_fee_level_1).toBe('number');
    expect(result[0].referral_fee_level_2).toBe(null);

    // Verify order details
    const pendingOrder = result.find(order => order.status === 'pending');
    const deliveredOrder = result.find(order => order.status === 'delivered');

    expect(pendingOrder).toBeDefined();
    expect(pendingOrder!.total_amount).toBe(100.50);
    expect(pendingOrder!.referral_fee_level_1).toBe(5.00);
    expect(pendingOrder!.shipping_address).toBe('123 Main St');

    expect(deliveredOrder).toBeDefined();
    expect(deliveredOrder!.total_amount).toBe(75.25);
    expect(deliveredOrder!.referral_fee_level_2).toBe(3.50);
  });

  it('should return empty array for user with no orders', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    const input: GetUserOrdersInput = {
      user_id: userId
    };

    const result = await getUserOrders(input);

    expect(result).toHaveLength(0);
  });

  it('should support pagination with limit', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create multiple orders
    const orderValues = Array.from({ length: 5 }, (_, i) => ({
      user_id: userId,
      status: 'pending' as const,
      total_amount: `${(i + 1) * 10}.00`
    }));

    await db.insert(ordersTable)
      .values(orderValues)
      .execute();

    const input: GetUserOrdersInput = {
      user_id: userId,
      limit: 3
    };

    const result = await getUserOrders(input);

    expect(result).toHaveLength(3);
    result.forEach(order => {
      expect(order.user_id).toBe(userId);
      expect(typeof order.total_amount).toBe('number');
    });
  });

  it('should support pagination with offset', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create multiple orders with different amounts for easy identification
    const orderValues = Array.from({ length: 5 }, (_, i) => ({
      user_id: userId,
      status: 'pending' as const,
      total_amount: `${(i + 1) * 10}.00`
    }));

    await db.insert(ordersTable)
      .values(orderValues)
      .execute();

    const input: GetUserOrdersInput = {
      user_id: userId,
      limit: 2,
      offset: 2
    };

    const result = await getUserOrders(input);

    expect(result).toHaveLength(2);
    result.forEach(order => {
      expect(order.user_id).toBe(userId);
      expect(typeof order.total_amount).toBe('number');
    });
  });

  it('should return orders in descending order by created_at', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create orders with different amounts (they'll have different created_at times)
    await db.insert(ordersTable)
      .values([
        {
          user_id: userId,
          status: 'pending',
          total_amount: '10.00'
        }
      ])
      .execute();

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(ordersTable)
      .values([
        {
          user_id: userId,
          status: 'processing',
          total_amount: '20.00'
        }
      ])
      .execute();

    const input: GetUserOrdersInput = {
      user_id: userId
    };

    const result = await getUserOrders(input);

    expect(result).toHaveLength(2);
    
    // First order should be the more recent one (processing, 20.00)
    expect(result[0].total_amount).toBe(20.00);
    expect(result[0].status).toBe('processing');
    
    // Second order should be the older one (pending, 10.00)
    expect(result[1].total_amount).toBe(10.00);
    expect(result[1].status).toBe('pending');

    // Verify timestamps are in descending order
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
  });

  it('should handle null referral fees correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser1])
      .returning()
      .execute();

    const userId = users[0].id;

    // Create order without referral fees
    await db.insert(ordersTable)
      .values([
        {
          user_id: userId,
          status: 'pending',
          total_amount: '50.00'
          // No referral fees set - should remain null
        }
      ])
      .execute();

    const input: GetUserOrdersInput = {
      user_id: userId
    };

    const result = await getUserOrders(input);

    expect(result).toHaveLength(1);
    expect(result[0].total_amount).toBe(50.00);
    expect(result[0].referral_fee_level_1).toBe(null);
    expect(result[0].referral_fee_level_2).toBe(null);
    expect(result[0].shipping_address).toBe(null);
  });
});