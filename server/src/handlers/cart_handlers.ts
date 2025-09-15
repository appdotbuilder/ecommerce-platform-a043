import { db } from '../db';
import { cartItemsTable, usersTable, productsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput, type GetUserCartInput, type CartItem } from '../schema';
import { eq, and, sum } from 'drizzle-orm';

export const addToCart = async (input: AddToCartInput): Promise<CartItem> => {
  try {
    // Check if user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (existingUser.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();
    
    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${input.product_id} not found`);
    }

    // Check if item already exists in cart
    const existingCartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.user_id, input.user_id),
        eq(cartItemsTable.product_id, input.product_id)
      ))
      .execute();

    if (existingCartItem.length > 0) {
      // Update existing item quantity
      const updatedQuantity = existingCartItem[0].quantity + input.quantity;
      const result = await db.update(cartItemsTable)
        .set({
          quantity: updatedQuantity,
          updated_at: new Date()
        })
        .where(eq(cartItemsTable.id, existingCartItem[0].id))
        .returning()
        .execute();

      return result[0];
    } else {
      // Insert new cart item
      const result = await db.insert(cartItemsTable)
        .values({
          user_id: input.user_id,
          product_id: input.product_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      return result[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
};

export const updateCartItem = async (input: UpdateCartItemInput): Promise<CartItem> => {
  try {
    // Check if cart item exists
    const existingItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, input.id))
      .execute();
    
    if (existingItem.length === 0) {
      throw new Error(`Cart item with id ${input.id} not found`);
    }

    const result = await db.update(cartItemsTable)
      .set({
        quantity: input.quantity,
        updated_at: new Date()
      })
      .where(eq(cartItemsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update cart item failed:', error);
    throw error;
  }
};

export const getUserCart = async (input: GetUserCartInput): Promise<CartItem[]> => {
  try {
    const result = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.user_id, input.user_id))
      .execute();

    return result;
  } catch (error) {
    console.error('Get user cart failed:', error);
    throw error;
  }
};

export const removeFromCart = async (cartItemId: number): Promise<boolean> => {
  try {
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
};

export const clearCart = async (userId: number): Promise<boolean> => {
  try {
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return true;
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
};

export const getCartItemsCount = async (userId: number): Promise<number> => {
  try {
    const result = await db.select({
      total: sum(cartItemsTable.quantity)
    })
    .from(cartItemsTable)
    .where(eq(cartItemsTable.user_id, userId))
    .execute();

    // Handle case where user has no cart items (sum returns null)
    const total = result[0]?.total;
    return total ? parseInt(total as string) : 0;
  } catch (error) {
    console.error('Get cart items count failed:', error);
    throw error;
  }
};