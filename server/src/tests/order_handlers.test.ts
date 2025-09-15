import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  productsTable, 
  addressesTable,
  ordersTable,
  orderItemsTable,
  distributorsTable,
  commissionsTable
} from '../db/schema';
import { 
  type CreateOrderInput, 
  type UpdateOrderStatusInput, 
  type GetOrdersInput 
} from '../schema';
import {
  createOrder,
  updateOrderStatus,
  getOrders,
  getOrderById,
  getOrderItems,
  cancelOrder,
  processPayment
} from '../handlers/order_handlers';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  phone: '1234567890',
  password_hash: 'hashedpassword',
  role: 'consumer' as const
};

const testCategory = {
  name: 'Test Category',
  description: 'A category for testing',
  sort_order: 0
};

const testProduct = {
  name: 'Test Product',
  description: 'A product for testing',
  price: '29.99',
  category_id: 1,
  product_type: 'physical' as const,
  stock_quantity: 50,
  sku: 'TEST-001',
  images: ['test.jpg']
};

const testAddress = {
  user_id: 1,
  recipient_name: 'John Doe',
  phone: '1234567890',
  province: 'Test Province',
  city: 'Test City',
  district: 'Test District',
  street_address: '123 Test Street',
  postal_code: '12345',
  is_default: true
};

const testDistributor = {
  user_id: 2,
  referral_code: 'REF001',
  commission_rate: '0.1000'
};

describe('Order Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createOrder', () => {
    let userId: number;
    let categoryId: number;
    let productId: number;
    let addressId: number;
    let distributorUserId: number;

    beforeEach(async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      userId = userResult[0].id;

      // Create distributor user
      const distributorUserResult = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'distributor',
          email: 'distributor@example.com'
        })
        .returning()
        .execute();
      distributorUserId = distributorUserResult[0].id;

      // Create test category
      const categoryResult = await db.insert(categoriesTable)
        .values(testCategory)
        .returning()
        .execute();
      categoryId = categoryResult[0].id;

      // Create test product
      const productResult = await db.insert(productsTable)
        .values({
          ...testProduct,
          category_id: categoryId
        })
        .returning()
        .execute();
      productId = productResult[0].id;

      // Create test address
      const addressResult = await db.insert(addressesTable)
        .values({
          ...testAddress,
          user_id: userId
        })
        .returning()
        .execute();
      addressId = addressResult[0].id;

      // Create test distributor
      await db.insert(distributorsTable)
        .values({
          ...testDistributor,
          user_id: distributorUserId
        })
        .execute();
    });

    const createOrderInput: CreateOrderInput = {
      user_id: 0, // Will be set in test
      items: [
        {
          product_id: 0, // Will be set in test
          quantity: 2,
          unit_price: 29.99
        }
      ],
      shipping_address_id: 0, // Will be set in test
      payment_method: 'credit_card',
      notes: 'Test order notes',
      referral_code: null
    };

    it('should create an order successfully', async () => {
      const input = {
        ...createOrderInput,
        user_id: userId,
        items: [{
          ...createOrderInput.items[0],
          product_id: productId
        }],
        shipping_address_id: addressId
      };

      const result = await createOrder(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(userId);
      expect(result.order_number).toMatch(/^ORD\d+[A-Z0-9]{6}$/);
      expect(result.total_amount).toEqual(59.98); // 2 * 29.99
      expect(result.shipping_fee).toEqual(10.00);
      expect(result.final_amount).toEqual(69.98); // 59.98 + 10.00
      expect(result.status).toEqual('pending');
      expect(result.payment_status).toEqual('pending');
      expect(result.shipping_address).toContain('John Doe');
      expect(result.notes).toEqual('Test order notes');
    });

    it('should create order items and update inventory', async () => {
      const input = {
        ...createOrderInput,
        user_id: userId,
        items: [{
          ...createOrderInput.items[0],
          product_id: productId
        }],
        shipping_address_id: addressId
      };

      const result = await createOrder(input);

      // Check order items were created
      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, result.id))
        .execute();

      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].product_id).toEqual(productId);
      expect(orderItems[0].quantity).toEqual(2);
      expect(parseFloat(orderItems[0].unit_price)).toEqual(29.99);
      expect(parseFloat(orderItems[0].total_price)).toEqual(59.98);

      // Check inventory was updated
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(updatedProduct[0].stock_quantity).toEqual(48); // 50 - 2
    });

    it('should handle distributor commission with referral code', async () => {
      const input = {
        ...createOrderInput,
        user_id: userId,
        items: [{
          ...createOrderInput.items[0],
          product_id: productId
        }],
        shipping_address_id: addressId,
        referral_code: 'REF001'
      };

      const result = await createOrder(input);

      // Check commission was created
      const commissions = await db.select()
        .from(commissionsTable)
        .where(eq(commissionsTable.order_id, result.id))
        .execute();

      expect(commissions).toHaveLength(1);
      expect(parseFloat(commissions[0].commission_amount)).toBeCloseTo(6.998, 2); // 69.98 * 0.1
      expect(commissions[0].status).toEqual('pending');
    });

    it('should throw error for non-existent user', async () => {
      const input = {
        ...createOrderInput,
        user_id: 99999,
        items: [{
          ...createOrderInput.items[0],
          product_id: productId
        }],
        shipping_address_id: addressId
      };

      await expect(createOrder(input)).rejects.toThrow(/User with id 99999 not found/);
    });

    it('should throw error for insufficient stock', async () => {
      const input = {
        ...createOrderInput,
        user_id: userId,
        items: [{
          ...createOrderInput.items[0],
          product_id: productId,
          quantity: 100 // More than available stock
        }],
        shipping_address_id: addressId
      };

      await expect(createOrder(input)).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe('updateOrderStatus', () => {
    let orderId: number;
    let productId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create category
      const categoryResult = await db.insert(categoriesTable)
        .values(testCategory)
        .returning()
        .execute();

      // Create product
      const productResult = await db.insert(productsTable)
        .values({
          ...testProduct,
          category_id: categoryResult[0].id,
          stock_quantity: 45 // Reduced stock as if order was created
        })
        .returning()
        .execute();
      productId = productResult[0].id;

      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'TEST001',
          total_amount: '59.98',
          shipping_fee: '10.00',
          discount_amount: '0.00',
          final_amount: '69.98',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'credit_card',
          shipping_address: 'Test Address',
          notes: null
        })
        .returning()
        .execute();
      orderId = orderResult[0].id;

      // Create order item
      await db.insert(orderItemsTable)
        .values({
          order_id: orderId,
          product_id: productId,
          quantity: 5,
          unit_price: '29.99',
          total_price: '149.95'
        })
        .execute();
    });

    it('should update order status successfully', async () => {
      const input: UpdateOrderStatusInput = {
        id: orderId,
        status: 'shipped'
      };

      const result = await updateOrderStatus(input);

      expect(result.id).toEqual(orderId);
      expect(result.status).toEqual('shipped');
    });

    it('should restore inventory when cancelling order', async () => {
      const input: UpdateOrderStatusInput = {
        id: orderId,
        status: 'cancelled'
      };

      await updateOrderStatus(input);

      // Check inventory was restored
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(updatedProduct[0].stock_quantity).toEqual(50); // 45 + 5 restored
    });

    it('should throw error for non-existent order', async () => {
      const input: UpdateOrderStatusInput = {
        id: 99999,
        status: 'shipped'
      };

      await expect(updateOrderStatus(input)).rejects.toThrow(/Order with id 99999 not found/);
    });
  });

  describe('getOrders', () => {
    let userId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      userId = userResult[0].id;

      // Create test orders
      await db.insert(ordersTable)
        .values([
          {
            user_id: userId,
            order_number: 'TEST001',
            total_amount: '59.98',
            shipping_fee: '10.00',
            discount_amount: '0.00',
            final_amount: '69.98',
            status: 'pending',
            payment_status: 'pending',
            payment_method: 'credit_card',
            shipping_address: 'Test Address',
            notes: null
          },
          {
            user_id: userId,
            order_number: 'TEST002',
            total_amount: '29.99',
            shipping_fee: '10.00',
            discount_amount: '0.00',
            final_amount: '39.99',
            status: 'shipped',
            payment_status: 'paid',
            payment_method: 'paypal',
            shipping_address: 'Test Address 2',
            notes: null
          }
        ])
        .execute();
    });

    it('should get all orders with pagination', async () => {
      const input: GetOrdersInput = {
        page: 1,
        limit: 20
      };

      const result = await getOrders(input);

      expect(result.orders).toHaveLength(2);
      expect(result.total).toEqual(2);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(20);
      expect(typeof result.orders[0].total_amount).toEqual('number');
    });

    it('should filter orders by user_id', async () => {
      const input: GetOrdersInput = {
        user_id: userId,
        page: 1,
        limit: 20
      };

      const result = await getOrders(input);

      expect(result.orders).toHaveLength(2);
      expect(result.orders.every(order => order.user_id === userId)).toBe(true);
    });

    it('should filter orders by status', async () => {
      const input: GetOrdersInput = {
        status: 'pending',
        page: 1,
        limit: 20
      };

      const result = await getOrders(input);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].status).toEqual('pending');
    });
  });

  describe('getOrderById', () => {
    let orderId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'TEST001',
          total_amount: '59.98',
          shipping_fee: '10.00',
          discount_amount: '0.00',
          final_amount: '69.98',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'credit_card',
          shipping_address: 'Test Address',
          notes: null
        })
        .returning()
        .execute();
      orderId = orderResult[0].id;
    });

    it('should get order by id', async () => {
      const result = await getOrderById(orderId);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(orderId);
      expect(result!.order_number).toEqual('TEST001');
      expect(typeof result!.total_amount).toEqual('number');
    });

    it('should return null for non-existent order', async () => {
      const result = await getOrderById(99999);

      expect(result).toBeNull();
    });
  });

  describe('getOrderItems', () => {
    let orderId: number;
    let productId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create category
      const categoryResult = await db.insert(categoriesTable)
        .values(testCategory)
        .returning()
        .execute();

      // Create product
      const productResult = await db.insert(productsTable)
        .values({
          ...testProduct,
          category_id: categoryResult[0].id
        })
        .returning()
        .execute();
      productId = productResult[0].id;

      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'TEST001',
          total_amount: '59.98',
          shipping_fee: '10.00',
          discount_amount: '0.00',
          final_amount: '69.98',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'credit_card',
          shipping_address: 'Test Address',
          notes: null
        })
        .returning()
        .execute();
      orderId = orderResult[0].id;

      // Create order items
      await db.insert(orderItemsTable)
        .values([
          {
            order_id: orderId,
            product_id: productId,
            quantity: 2,
            unit_price: '29.99',
            total_price: '59.98'
          }
        ])
        .execute();
    });

    it('should get order items', async () => {
      const result = await getOrderItems(orderId);

      expect(result).toHaveLength(1);
      expect(result[0].order_id).toEqual(orderId);
      expect(result[0].product_id).toEqual(productId);
      expect(result[0].quantity).toEqual(2);
      expect(typeof result[0].unit_price).toEqual('number');
      expect(typeof result[0].total_price).toEqual('number');
    });
  });

  describe('cancelOrder', () => {
    let orderId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'TEST001',
          total_amount: '59.98',
          shipping_fee: '10.00',
          discount_amount: '0.00',
          final_amount: '69.98',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'credit_card',
          shipping_address: 'Test Address',
          notes: null
        })
        .returning()
        .execute();
      orderId = orderResult[0].id;
    });

    it('should cancel order', async () => {
      const result = await cancelOrder(orderId);

      expect(result.id).toEqual(orderId);
      expect(result.status).toEqual('cancelled');
    });
  });

  describe('processPayment', () => {
    let orderId: number;

    beforeEach(async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'TEST001',
          total_amount: '59.98',
          shipping_fee: '10.00',
          discount_amount: '0.00',
          final_amount: '69.98',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'credit_card',
          shipping_address: 'Test Address',
          notes: null
        })
        .returning()
        .execute();
      orderId = orderResult[0].id;
    });

    it('should process payment successfully', async () => {
      const paymentData = { transaction_id: 'txn_123' };
      const result = await processPayment(orderId, paymentData);

      expect(result.id).toEqual(orderId);
      expect(result.status).toEqual('paid');
      expect(result.payment_status).toEqual('paid');
    });

    it('should throw error for non-existent order', async () => {
      const paymentData = { transaction_id: 'txn_123' };

      await expect(processPayment(99999, paymentData)).rejects.toThrow(/Order with id 99999 not found/);
    });
  });
});