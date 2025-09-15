import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput, type GetUserCartInput } from '../schema';
import { addToCart, updateCartItem, getUserCart, removeFromCart, clearCart, getCartItemsCount } from '../handlers/cart_handlers';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  phone: '+1234567890',
  password_hash: 'hashed_password',
  role: 'consumer' as const
};

const testCategory = {
  name: 'Electronics',
  description: 'Electronic products',
  sort_order: 0
};

const testProduct = {
  name: 'Test Product',
  description: 'A product for testing',
  price: '19.99',
  category_id: 1,
  product_type: 'physical' as const,
  stock_quantity: 100,
  sku: 'TEST-001'
};

let userId: number;
let productId: number;

describe('Cart Handlers', () => {
  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test category
    await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();

    // Create test product
    const productResult = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();
    productId = productResult[0].id;
  });

  afterEach(resetDB);

  describe('addToCart', () => {
    const addToCartInput: AddToCartInput = {
      user_id: 0, // Will be set in tests
      product_id: 0, // Will be set in tests
      quantity: 2
    };

    it('should add new item to cart', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId };
      
      const result = await addToCart(input);

      expect(result.user_id).toEqual(userId);
      expect(result.product_id).toEqual(productId);
      expect(result.quantity).toEqual(2);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update existing cart item quantity', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId, quantity: 3 };
      
      // Add item first time
      const firstResult = await addToCart(input);
      expect(firstResult.quantity).toEqual(3);

      // Add same item again
      const secondInput = { ...input, quantity: 2 };
      const secondResult = await addToCart(secondInput);

      expect(secondResult.id).toEqual(firstResult.id);
      expect(secondResult.quantity).toEqual(5); // 3 + 2
      expect(secondResult.user_id).toEqual(userId);
      expect(secondResult.product_id).toEqual(productId);
    });

    it('should save cart item to database', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId };
      
      const result = await addToCart(input);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, result.id))
        .execute();

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].user_id).toEqual(userId);
      expect(cartItems[0].product_id).toEqual(productId);
      expect(cartItems[0].quantity).toEqual(2);
    });

    it('should throw error for non-existent user', async () => {
      const input = { ...addToCartInput, user_id: 99999, product_id: productId };
      
      await expect(addToCart(input)).rejects.toThrow(/User with id 99999 not found/i);
    });

    it('should throw error for non-existent product', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: 99999 };
      
      await expect(addToCart(input)).rejects.toThrow(/Product with id 99999 not found/i);
    });
  });

  describe('updateCartItem', () => {
    let cartItemId: number;

    beforeEach(async () => {
      // Add item to cart first
      const input: AddToCartInput = {
        user_id: userId,
        product_id: productId,
        quantity: 3
      };
      const cartItem = await addToCart(input);
      cartItemId = cartItem.id;
    });

    it('should update cart item quantity', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 5
      };

      const result = await updateCartItem(input);

      expect(result.id).toEqual(cartItemId);
      expect(result.quantity).toEqual(5);
      expect(result.user_id).toEqual(userId);
      expect(result.product_id).toEqual(productId);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save updated quantity to database', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 7
      };

      await updateCartItem(input);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].quantity).toEqual(7);
    });

    it('should throw error for non-existent cart item', async () => {
      const input: UpdateCartItemInput = {
        id: 99999,
        quantity: 5
      };

      await expect(updateCartItem(input)).rejects.toThrow(/Cart item with id 99999 not found/i);
    });
  });

  describe('getUserCart', () => {
    it('should return empty array for user with no cart items', async () => {
      const input: GetUserCartInput = {
        user_id: userId
      };

      const result = await getUserCart(input);

      expect(result).toEqual([]);
    });

    it('should return user cart items', async () => {
      // Add multiple items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });

      // Create second product
      const secondProduct = await db.insert(productsTable)
        .values({
          ...testProduct,
          name: 'Second Product',
          sku: 'TEST-002'
        })
        .returning()
        .execute();

      await addToCart({ user_id: userId, product_id: secondProduct[0].id, quantity: 3 });

      const input: GetUserCartInput = {
        user_id: userId
      };

      const result = await getUserCart(input);

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toEqual(userId);
      expect(result[0].quantity).toEqual(2);
      expect(result[1].user_id).toEqual(userId);
      expect(result[1].quantity).toEqual(3);
    });

    it('should not return other users cart items', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'seconduser',
          email: 'second@example.com'
        })
        .returning()
        .execute();

      // Add items for both users
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
      await addToCart({ user_id: secondUser[0].id, product_id: productId, quantity: 5 });

      const input: GetUserCartInput = {
        user_id: userId
      };

      const result = await getUserCart(input);

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toEqual(userId);
      expect(result[0].quantity).toEqual(2);
    });
  });

  describe('removeFromCart', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
      cartItemId = cartItem.id;
    });

    it('should remove cart item and return true', async () => {
      const result = await removeFromCart(cartItemId);

      expect(result).toBe(true);

      // Verify item is removed from database
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should return false for non-existent cart item', async () => {
      const result = await removeFromCart(99999);

      expect(result).toBe(false);
    });
  });

  describe('clearCart', () => {
    beforeEach(async () => {
      // Add multiple items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });

      const secondProduct = await db.insert(productsTable)
        .values({
          ...testProduct,
          name: 'Second Product',
          sku: 'TEST-002'
        })
        .returning()
        .execute();

      await addToCart({ user_id: userId, product_id: secondProduct[0].id, quantity: 3 });
    });

    it('should clear all cart items for user', async () => {
      const result = await clearCart(userId);

      expect(result).toBe(true);

      // Verify all items are removed
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, userId))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should not affect other users carts', async () => {
      // Create second user with cart items
      const secondUser = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'seconduser',
          email: 'second@example.com'
        })
        .returning()
        .execute();

      await addToCart({ user_id: secondUser[0].id, product_id: productId, quantity: 1 });

      // Clear first user's cart
      await clearCart(userId);

      // Check second user's cart is intact
      const secondUserCart = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, secondUser[0].id))
        .execute();

      expect(secondUserCart).toHaveLength(1);
      expect(secondUserCart[0].quantity).toEqual(1);
    });

    it('should return true even if user has no cart items', async () => {
      // Clear cart first
      await clearCart(userId);
      
      // Clear again
      const result = await clearCart(userId);

      expect(result).toBe(true);
    });
  });

  describe('getCartItemsCount', () => {
    it('should return 0 for user with no cart items', async () => {
      const result = await getCartItemsCount(userId);

      expect(result).toEqual(0);
    });

    it('should return total count of items in cart', async () => {
      // Add multiple items with different quantities
      await addToCart({ user_id: userId, product_id: productId, quantity: 3 });

      const secondProduct = await db.insert(productsTable)
        .values({
          ...testProduct,
          name: 'Second Product',
          sku: 'TEST-002'
        })
        .returning()
        .execute();

      await addToCart({ user_id: userId, product_id: secondProduct[0].id, quantity: 5 });

      const result = await getCartItemsCount(userId);

      expect(result).toEqual(8); // 3 + 5
    });

    it('should not include other users cart items', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'seconduser',
          email: 'second@example.com'
        })
        .returning()
        .execute();

      // Add items for both users
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
      await addToCart({ user_id: secondUser[0].id, product_id: productId, quantity: 10 });

      const result = await getCartItemsCount(userId);

      expect(result).toEqual(2);
    });
  });
});