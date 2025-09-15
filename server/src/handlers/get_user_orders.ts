import { db } from '../db';
import { ordersTable } from '../db/schema';
import { type GetUserOrdersInput, type Order } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserOrders = async (input: GetUserOrdersInput): Promise<Order[]> => {
  try {
    // Apply limit and offset with defaults
    const limit = input.limit || 50; // Default limit to prevent unbounded queries
    const offset = input.offset || 0;

    // Build complete query in one chain
    const results = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, input.user_id))
      .orderBy(desc(ordersTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount),
      referral_fee_level_1: order.referral_fee_level_1 ? parseFloat(order.referral_fee_level_1) : null,
      referral_fee_level_2: order.referral_fee_level_2 ? parseFloat(order.referral_fee_level_2) : null
    }));
  } catch (error) {
    console.error('Get user orders failed:', error);
    throw error;
  }
};