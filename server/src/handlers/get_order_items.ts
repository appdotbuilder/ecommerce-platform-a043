import { db } from '../db';
import { orderItemsTable, productsTable } from '../db/schema';
import { type OrderItem } from '../schema';
import { eq } from 'drizzle-orm';

export const getOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  try {
    // Query order items with joined product information
    const results = await db.select()
      .from(orderItemsTable)
      .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    // Transform results to include product information and convert numeric fields
    return results.map(result => ({
      id: result.order_items.id,
      order_id: result.order_items.order_id,
      product_id: result.order_items.product_id,
      quantity: result.order_items.quantity,
      unit_price: parseFloat(result.order_items.unit_price), // Convert string to number
      total_price: parseFloat(result.order_items.total_price), // Convert string to number
      created_at: result.order_items.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch order items:', error);
    throw error;
  }
};