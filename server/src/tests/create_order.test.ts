import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable, referralCommissionsTable } from '../db/schema';
import { type CreateOrderInput } from '../schema';
import { createOrder } from '../handlers/create_order';
import { eq } from 'drizzle-orm';


describe('createOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helper
  const setupTestData = async () => {
    // Create users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'customer@test.com',
          password_hash: 'hashed_password_123',
          first_name: 'John',
          last_name: 'Customer',
          role: 'user'
        },
        {
          email: 'distributor1@test.com',
          password_hash: 'hashed_password_123',
          first_name: 'Jane',
          last_name: 'Distributor1',
          role: 'distributor'
        },
        {
          email: 'distributor2@test.com',
          password_hash: 'hashed_password_123',
          first_name: 'Bob',
          last_name: 'Distributor2',
          role: 'distributor'
        }
      ])
      .returning()
      .execute();

    const [customer, distributor1, distributor2] = userResults;

    // Update customer with referral chain
    await db.update(usersTable)
      .set({
        referrer_id: distributor1.id,
        secondary_referrer_id: distributor2.id
      })
      .where(eq(usersTable.id, customer.id))
      .execute();

    // Create products
    const productResults = await db.insert(productsTable)
      .values([
        {
          name: 'Physical Product',
          description: 'A physical product',
          type: 'physical',
          price: '99.99',
          stock_quantity: 10,
          is_enabled: true
        },
        {
          name: 'Virtual Product',
          description: 'A virtual product',
          type: 'virtual',
          price: '49.99',
          stock_quantity: 0,
          is_enabled: true
        },
        {
          name: 'Disabled Product',
          description: 'A disabled product',
          type: 'physical',
          price: '29.99',
          stock_quantity: 5,
          is_enabled: false
        }
      ])
      .returning()
      .execute();

    return {
      customer,
      distributor1,
      distributor2,
      products: productResults
    };
  };

  it('should create order with physical and virtual products', async () => {
    const { customer, products } = await setupTestData();
    const [physicalProduct, virtualProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 2 },
        { product_id: virtualProduct.id, quantity: 1 }
      ],
      shipping_address: '123 Test Street, Test City, TC 12345'
    };

    const result = await createOrder(input);

    // Verify order details
    expect(result.user_id).toEqual(customer.id);
    expect(result.status).toEqual('pending');
    expect(result.total_amount).toEqual(249.97); // (99.99 * 2) + 49.99
    expect(result.shipping_address).toEqual(input.shipping_address!);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify referral fees are calculated
    expect(result.referral_fee_level_1).toBeCloseTo(12.50, 2); // 5% of 249.97
    expect(result.referral_fee_level_2).toBeCloseTo(7.50, 2); // 3% of 249.97
  });

  it('should create order items correctly', async () => {
    const { customer, products } = await setupTestData();
    const [physicalProduct, virtualProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 2 },
        { product_id: virtualProduct.id, quantity: 1 }
      ]
    };

    const result = await createOrder(input);

    // Check order items were created
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, result.id))
      .execute();

    expect(orderItems).toHaveLength(2);

    const physicalItem = orderItems.find(item => item.product_id === physicalProduct.id);
    expect(physicalItem).toBeDefined();
    expect(physicalItem!.quantity).toEqual(2);
    expect(parseFloat(physicalItem!.unit_price)).toEqual(99.99);
    expect(parseFloat(physicalItem!.total_price)).toEqual(199.98);

    const virtualItem = orderItems.find(item => item.product_id === virtualProduct.id);
    expect(virtualItem).toBeDefined();
    expect(virtualItem!.quantity).toEqual(1);
    expect(parseFloat(virtualItem!.unit_price)).toEqual(49.99);
    expect(parseFloat(virtualItem!.total_price)).toEqual(49.99);
  });

  it('should update inventory for physical products only', async () => {
    const { customer, products } = await setupTestData();
    const [physicalProduct, virtualProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 3 },
        { product_id: virtualProduct.id, quantity: 5 }
      ]
    };

    await createOrder(input);

    // Check inventory was updated for physical product
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, physicalProduct.id))
      .execute();

    expect(updatedProducts[0].stock_quantity).toEqual(7); // 10 - 3

    // Check virtual product inventory unchanged
    const virtualProductUpdated = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, virtualProduct.id))
      .execute();

    expect(virtualProductUpdated[0].stock_quantity).toEqual(0); // Unchanged
  });

  it('should create referral commission records', async () => {
    const { customer, distributor1, distributor2, products } = await setupTestData();
    const [physicalProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 1 }
      ]
    };

    const result = await createOrder(input);

    // Check referral commissions were created
    const commissions = await db.select()
      .from(referralCommissionsTable)
      .where(eq(referralCommissionsTable.order_id, result.id))
      .execute();

    expect(commissions).toHaveLength(2);

    const level1Commission = commissions.find(c => c.level === 1);
    expect(level1Commission).toBeDefined();
    expect(level1Commission!.distributor_id).toEqual(distributor1.id);
    expect(parseFloat(level1Commission!.commission_percentage)).toEqual(5.0);
    expect(parseFloat(level1Commission!.commission_amount)).toBeCloseTo(5.00, 2); // 5% of 99.99

    const level2Commission = commissions.find(c => c.level === 2);
    expect(level2Commission).toBeDefined();
    expect(level2Commission!.distributor_id).toEqual(distributor2.id);
    expect(parseFloat(level2Commission!.commission_percentage)).toEqual(3.0);
    expect(parseFloat(level2Commission!.commission_amount)).toBeCloseTo(3.00, 2); // 3% of 99.99
  });

  it('should handle user without referrers', async () => {
    // Create user without referrers
    const userResult = await db.insert(usersTable)
      .values({
        email: 'noreferrer@test.com',
        password_hash: 'hashed_password_456',
        first_name: 'No',
        last_name: 'Referrer',
        role: 'user'
      })
      .returning()
      .execute();

    const { products } = await setupTestData();
    const [physicalProduct] = products;

    const input: CreateOrderInput = {
      user_id: userResult[0].id,
      items: [
        { product_id: physicalProduct.id, quantity: 1 }
      ]
    };

    const result = await createOrder(input);

    // Verify no referral fees
    expect(result.referral_fee_level_1).toBeNull();
    expect(result.referral_fee_level_2).toBeNull();

    // Verify no commission records created
    const commissions = await db.select()
      .from(referralCommissionsTable)
      .where(eq(referralCommissionsTable.order_id, result.id))
      .execute();

    expect(commissions).toHaveLength(0);
  });

  it('should throw error for insufficient inventory', async () => {
    const { customer, products } = await setupTestData();
    const [physicalProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 15 } // More than available (10)
      ]
    };

    await expect(createOrder(input)).rejects.toThrow(/insufficient inventory/i);
  });

  it('should throw error for disabled products', async () => {
    const { customer, products } = await setupTestData();
    const [, , disabledProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: disabledProduct.id, quantity: 1 }
      ]
    };

    await expect(createOrder(input)).rejects.toThrow(/not available or disabled/i);
  });

  it('should throw error for non-existent products', async () => {
    const { customer } = await setupTestData();

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: 99999, quantity: 1 } // Non-existent product ID
      ]
    };

    await expect(createOrder(input)).rejects.toThrow(/not available or disabled/i);
  });

  it('should throw error for non-existent user', async () => {
    const { products } = await setupTestData();
    const [physicalProduct] = products;

    const input: CreateOrderInput = {
      user_id: 99999, // Non-existent user ID
      items: [
        { product_id: physicalProduct.id, quantity: 1 }
      ]
    };

    await expect(createOrder(input)).rejects.toThrow(/user not found/i);
  });

  it('should handle order with only virtual products', async () => {
    const { customer, products } = await setupTestData();
    const [, virtualProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: virtualProduct.id, quantity: 3 }
      ]
    };

    const result = await createOrder(input);

    expect(result.total_amount).toEqual(149.97); // 49.99 * 3
    expect(result.shipping_address).toBeNull();

    // Verify virtual product inventory unchanged
    const updatedProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, virtualProduct.id))
      .execute();

    expect(updatedProduct[0].stock_quantity).toEqual(0); // Unchanged
  });

  it('should save order to database correctly', async () => {
    const { customer, products } = await setupTestData();
    const [physicalProduct] = products;

    const input: CreateOrderInput = {
      user_id: customer.id,
      items: [
        { product_id: physicalProduct.id, quantity: 1 }
      ],
      shipping_address: '456 Another Street'
    };

    const result = await createOrder(input);

    // Verify order was saved to database
    const savedOrder = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, result.id))
      .execute();

    expect(savedOrder).toHaveLength(1);
    expect(savedOrder[0].user_id).toEqual(customer.id);
    expect(savedOrder[0].status).toEqual('pending');
    expect(parseFloat(savedOrder[0].total_amount)).toEqual(99.99);
    expect(savedOrder[0].shipping_address).toEqual('456 Another Street');
    expect(savedOrder[0].created_at).toBeInstanceOf(Date);
    expect(savedOrder[0].updated_at).toBeInstanceOf(Date);
  });
});