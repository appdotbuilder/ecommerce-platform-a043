import { db } from '../db';
import { ordersTable, usersTable, orderItemsTable, productsTable, referralCommissionsTable } from '../db/schema';
import { type Order } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    // Fetch all orders with user information, ordered by most recent first
    const results = await db.select()
      .from(ordersTable)
      .innerJoin(usersTable, eq(ordersTable.user_id, usersTable.id))
      .orderBy(desc(ordersTable.created_at))
      .execute();

    // Convert numeric fields back to numbers and structure the response
    return results.map(result => ({
      id: result.orders.id,
      user_id: result.orders.user_id,
      status: result.orders.status,
      total_amount: parseFloat(result.orders.total_amount),
      referral_fee_level_1: result.orders.referral_fee_level_1 ? parseFloat(result.orders.referral_fee_level_1) : null,
      referral_fee_level_2: result.orders.referral_fee_level_2 ? parseFloat(result.orders.referral_fee_level_2) : null,
      shipping_address: result.orders.shipping_address,
      created_at: result.orders.created_at,
      updated_at: result.orders.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch all orders:', error);
    throw error;
  }
};