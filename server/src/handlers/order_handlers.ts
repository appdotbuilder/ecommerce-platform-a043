import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  productsTable, 
  addressesTable,
  distributorsTable,
  commissionsTable,
  usersTable 
} from '../db/schema';
import { 
  type CreateOrderInput, 
  type UpdateOrderStatusInput, 
  type GetOrdersInput, 
  type Order, 
  type OrderItem 
} from '../schema';
import { eq, desc, and, count, sql, SQL } from 'drizzle-orm';

export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  try {
    // Generate unique order number
    const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Get shipping address
    const address = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, input.shipping_address_id))
      .execute();
    
    if (address.length === 0) {
      throw new Error(`Address with id ${input.shipping_address_id} not found`);
    }

    const shippingAddress = `${address[0].recipient_name}, ${address[0].street_address}, ${address[0].district}, ${address[0].city}, ${address[0].province} ${address[0].postal_code || ''}`.trim();

    // Verify products exist and calculate totals
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of input.items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();
      
      if (product.length === 0) {
        throw new Error(`Product with id ${item.product_id} not found`);
      }

      if (product[0].stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product[0].name}. Available: ${product[0].stock_quantity}, requested: ${item.quantity}`);
      }

      const itemTotal = item.quantity * item.unit_price;
      totalAmount += itemTotal;
      
      validatedItems.push({
        ...item,
        total_price: itemTotal
      });
    }

    const shippingFee = 10.00; // Fixed shipping fee for simplicity
    const discountAmount = 0; // No discount logic for now
    const finalAmount = totalAmount + shippingFee - discountAmount;

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        order_number: orderNumber,
        total_amount: totalAmount.toString(),
        shipping_fee: shippingFee.toString(),
        discount_amount: discountAmount.toString(),
        final_amount: finalAmount.toString(),
        status: 'pending',
        payment_status: 'pending',
        payment_method: input.payment_method,
        shipping_address: shippingAddress,
        notes: input.notes
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // Create order items and update inventory
    for (const item of validatedItems) {
      await db.insert(orderItemsTable)
        .values({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          total_price: item.total_price.toString()
        })
        .execute();

      // Update product stock
      await db.update(productsTable)
        .set({
          stock_quantity: sql`stock_quantity - ${item.quantity}`,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }

    // Handle distributor commission if referral code provided
    if (input.referral_code) {
      const distributor = await db.select()
        .from(distributorsTable)
        .where(eq(distributorsTable.referral_code, input.referral_code))
        .execute();
      
      if (distributor.length > 0 && distributor[0].status === 'active') {
        const commissionAmount = finalAmount * parseFloat(distributor[0].commission_rate);
        
        await db.insert(commissionsTable)
          .values({
            distributor_id: distributor[0].id,
            order_id: order.id,
            commission_amount: commissionAmount.toString(),
            commission_rate: distributor[0].commission_rate,
            status: 'pending'
          })
          .execute();
      }
    }

    // Convert numeric fields back to numbers
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_fee: parseFloat(order.shipping_fee),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
};

export const updateOrderStatus = async (input: UpdateOrderStatusInput): Promise<Order> => {
  try {
    // Get current order
    const currentOrder = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.id))
      .execute();
    
    if (currentOrder.length === 0) {
      throw new Error(`Order with id ${input.id} not found`);
    }

    const oldStatus = currentOrder[0].status;
    
    // Handle inventory restoration for cancelled orders
    if (input.status === 'cancelled' && oldStatus !== 'cancelled') {
      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, input.id))
        .execute();
      
      // Restore inventory
      for (const item of orderItems) {
        await db.update(productsTable)
          .set({
            stock_quantity: sql`stock_quantity + ${item.quantity}`,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
      }

      // Cancel related commissions
      await db.update(commissionsTable)
        .set({
          status: 'cancelled'
        })
        .where(eq(commissionsTable.order_id, input.id))
        .execute();
    }

    // Update order status
    const result = await db.update(ordersTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    const order = result[0];

    // Convert numeric fields back to numbers
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_fee: parseFloat(order.shipping_fee),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Order status update failed:', error);
    throw error;
  }
};

export const getOrders = async (input: GetOrdersInput): Promise<{ orders: Order[]; total: number; page: number; limit: number }> => {
  try {
    // Build conditions
    const conditions: SQL<unknown>[] = [];

    if (input.user_id !== undefined) {
      conditions.push(eq(ordersTable.user_id, input.user_id));
    }

    if (input.status) {
      conditions.push(eq(ordersTable.status, input.status));
    }

    // Build the main query
    const offset = (input.page - 1) * input.limit;
    
    const baseQuery = db.select().from(ordersTable);
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;
    
    const orders = await query
      .orderBy(desc(ordersTable.created_at))
      .limit(input.limit)
      .offset(offset)
      .execute();

    // Get total count
    const baseCountQuery = db.select({ count: count() }).from(ordersTable);
    const countQuery = conditions.length > 0 
      ? baseCountQuery.where(and(...conditions))
      : baseCountQuery;
    
    const totalResult = await countQuery.execute();
    const total = totalResult[0].count;

    // Convert numeric fields
    const convertedOrders = orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_fee: parseFloat(order.shipping_fee),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    }));

    return {
      orders: convertedOrders,
      total,
      page: input.page,
      limit: input.limit
    };
  } catch (error) {
    console.error('Get orders failed:', error);
    throw error;
  }
};

export const getOrderById = async (orderId: number): Promise<Order | null> => {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];

    // Convert numeric fields back to numbers
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_fee: parseFloat(order.shipping_fee),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Get order by id failed:', error);
    throw error;
  }
};

export const getOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  try {
    const items = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    // Convert numeric fields back to numbers
    return items.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price)
    }));
  } catch (error) {
    console.error('Get order items failed:', error);
    throw error;
  }
};

export const cancelOrder = async (orderId: number): Promise<Order> => {
  try {
    return await updateOrderStatus({ id: orderId, status: 'cancelled' });
  } catch (error) {
    console.error('Cancel order failed:', error);
    throw error;
  }
};

export const processPayment = async (orderId: number, paymentData: any): Promise<Order> => {
  try {
    // Get current order
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();
    
    if (orders.length === 0) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    // Update order payment status
    const result = await db.update(ordersTable)
      .set({
        status: 'paid',
        payment_status: 'paid',
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, orderId))
      .returning()
      .execute();

    const order = result[0];

    // Mark commissions as paid if order is paid
    await db.update(commissionsTable)
      .set({
        status: 'paid',
        paid_at: new Date()
      })
      .where(eq(commissionsTable.order_id, orderId))
      .execute();

    // Convert numeric fields back to numbers
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_fee: parseFloat(order.shipping_fee),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
};