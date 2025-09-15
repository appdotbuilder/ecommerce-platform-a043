import { db } from '../db';
import { ordersTable } from '../db/schema';
import { type UpdateOrderInput, type Order } from '../schema';
import { eq } from 'drizzle-orm';

export const updateOrder = async (input: UpdateOrderInput): Promise<Order> => {
  try {
    // First, check if the order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.id))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with ID ${input.id} not found`);
    }

    // Prepare update values - only include fields that are provided
    const updateValues: Partial<typeof ordersTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.status !== undefined) {
      updateValues.status = input.status;
    }

    if (input.shipping_address !== undefined) {
      updateValues.shipping_address = input.shipping_address;
    }

    // Update the order
    const result = await db.update(ordersTable)
      .set(updateValues)
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedOrder = result[0];
    return {
      ...updatedOrder,
      total_amount: parseFloat(updatedOrder.total_amount),
      referral_fee_level_1: updatedOrder.referral_fee_level_1 ? parseFloat(updatedOrder.referral_fee_level_1) : null,
      referral_fee_level_2: updatedOrder.referral_fee_level_2 ? parseFloat(updatedOrder.referral_fee_level_2) : null
    };
  } catch (error) {
    console.error('Order update failed:', error);
    throw error;
  }
};