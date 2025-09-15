import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateInventoryInput, type Product } from '../schema';
import { eq } from 'drizzle-orm';

export const updateInventory = async (input: UpdateInventoryInput): Promise<Product> => {
  try {
    // First, get the current product to validate it exists and check current stock
    const existingProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (existingProducts.length === 0) {
      throw new Error(`Product with id ${input.product_id} not found`);
    }

    const existingProduct = existingProducts[0];
    const currentStock = existingProduct.stock_quantity;
    const newStock = currentStock + input.quantity_change;

    // Prevent negative inventory
    if (newStock < 0) {
      throw new Error(`Insufficient inventory. Current stock: ${currentStock}, requested change: ${input.quantity_change}`);
    }

    // Update the product's stock quantity
    const result = await db.update(productsTable)
      .set({
        stock_quantity: newStock,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, input.product_id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedProduct = result[0];
    return {
      ...updatedProduct,
      price: parseFloat(updatedProduct.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Inventory update failed:', error);
    throw error;
  }
};