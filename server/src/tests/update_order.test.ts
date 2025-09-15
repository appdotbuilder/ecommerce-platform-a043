import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ordersTable } from '../db/schema';
import { type UpdateOrderInput } from '../schema';
import { updateOrder } from '../handlers/update_order';
import { eq } from 'drizzle-orm';

describe('updateOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test order
  const createTestOrder = async (userId: number) => {
    const result = await db.insert(ordersTable)
      .values({
        user_id: userId,
        status: 'pending',
        total_amount: '100.00',
        shipping_address: 'Original Address'
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should update order status', async () => {
    const user = await createTestUser();
    const order = await createTestOrder(user.id);

    const input: UpdateOrderInput = {
      id: order.id,
      status: 'processing'
    };

    const result = await updateOrder(input);

    expect(result.id).toEqual(order.id);
    expect(result.status).toEqual('processing');
    expect(result.user_id).toEqual(user.id);
    expect(result.total_amount).toEqual(100.00);
    expect(result.shipping_address).toEqual('Original Address');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > order.updated_at).toBe(true);
  });

  it('should update shipping address', async () => {
    const user = await createTestUser();
    const order = await createTestOrder(user.id);

    const input: UpdateOrderInput = {
      id: order.id,
      shipping_address: 'New Shipping Address'
    };

    const result = await updateOrder(input);

    expect(result.id).toEqual(order.id);
    expect(result.status).toEqual('pending'); // Should remain unchanged
    expect(result.shipping_address).toEqual('New Shipping Address');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update both status and shipping address', async () => {
    const user = await createTestUser();
    const order = await createTestOrder(user.id);

    const input: UpdateOrderInput = {
      id: order.id,
      status: 'shipped',
      shipping_address: 'Updated Address'
    };

    const result = await updateOrder(input);

    expect(result.id).toEqual(order.id);
    expect(result.status).toEqual('shipped');
    expect(result.shipping_address).toEqual('Updated Address');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle nullable shipping address', async () => {
    const user = await createTestUser();
    const order = await createTestOrder(user.id);

    const input: UpdateOrderInput = {
      id: order.id,
      shipping_address: null
    };

    const result = await updateOrder(input);

    expect(result.id).toEqual(order.id);
    expect(result.shipping_address).toBeNull();
  });

  it('should preserve referral fees when updating', async () => {
    const user = await createTestUser();
    
    // Create order with referral fees
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: user.id,
        status: 'pending',
        total_amount: '200.00',
        referral_fee_level_1: '10.00',
        referral_fee_level_2: '5.00',
        shipping_address: 'Original Address'
      })
      .returning()
      .execute();
    
    const order = orderResult[0];

    const input: UpdateOrderInput = {
      id: order.id,
      status: 'processing'
    };

    const result = await updateOrder(input);

    expect(result.referral_fee_level_1).toEqual(10.00);
    expect(result.referral_fee_level_2).toEqual(5.00);
    expect(typeof result.referral_fee_level_1).toBe('number');
    expect(typeof result.referral_fee_level_2).toBe('number');
  });

  it('should save changes to database', async () => {
    const user = await createTestUser();
    const order = await createTestOrder(user.id);

    const input: UpdateOrderInput = {
      id: order.id,
      status: 'delivered',
      shipping_address: 'Delivery Address'
    };

    await updateOrder(input);

    // Verify changes were saved to database
    const savedOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .execute();

    expect(savedOrders).toHaveLength(1);
    const savedOrder = savedOrders[0];
    expect(savedOrder.status).toEqual('delivered');
    expect(savedOrder.shipping_address).toEqual('Delivery Address');
    expect(savedOrder.updated_at).toBeInstanceOf(Date);
    expect(savedOrder.updated_at > order.updated_at).toBe(true);
  });

  it('should throw error when order does not exist', async () => {
    const input: UpdateOrderInput = {
      id: 999999, // Non-existent order ID
      status: 'processing'
    };

    await expect(updateOrder(input)).rejects.toThrow(/order with id 999999 not found/i);
  });

  it('should handle orders with null referral fees', async () => {
    const user = await createTestUser();
    
    // Create order without referral fees
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: user.id,
        status: 'pending',
        total_amount: '50.00',
        referral_fee_level_1: null,
        referral_fee_level_2: null
      })
      .returning()
      .execute();
    
    const order = orderResult[0];

    const input: UpdateOrderInput = {
      id: order.id,
      status: 'cancelled'
    };

    const result = await updateOrder(input);

    expect(result.referral_fee_level_1).toBeNull();
    expect(result.referral_fee_level_2).toBeNull();
    expect(result.status).toEqual('cancelled');
  });
});