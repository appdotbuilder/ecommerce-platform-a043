import { db } from '../db';
import { productsTable, ordersTable, orderItemsTable, usersTable, referralCommissionsTable } from '../db/schema';
import { type CreateOrderInput, type Order } from '../schema';
import { eq, and, inArray } from 'drizzle-orm';

export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  try {
    // Extract product IDs from items
    const productIds = input.items.map(item => item.product_id);
    
    // 1. Validate all products exist and are enabled
    const products = await db.select()
      .from(productsTable)
      .where(
        and(
          inArray(productsTable.id, productIds),
          eq(productsTable.is_enabled, true)
        )
      )
      .execute();

    if (products.length !== productIds.length) {
      throw new Error('Some products are not available or disabled');
    }

    // Create a map for quick product lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    // 2. Check inventory for physical products and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      // Check inventory for physical products
      if (product.type === 'physical' && product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient inventory for product ${product.name}`);
      }

      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        product: product // Keep reference for inventory update
      });
    }

    // 3. Get user and referral chain for commission calculation
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userData = user[0];
    
    // Get referrer information
    let referrer = null;
    let secondaryReferrer = null;
    let referralFeeLevel1 = null;
    let referralFeeLevel2 = null;

    if (userData.referrer_id) {
      const referrerResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userData.referrer_id))
        .execute();
      
      if (referrerResult.length > 0) {
        referrer = referrerResult[0];
        // 5% commission for first level
        referralFeeLevel1 = totalAmount * 0.05;
      }
    }

    if (userData.secondary_referrer_id) {
      const secondaryReferrerResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userData.secondary_referrer_id))
        .execute();
      
      if (secondaryReferrerResult.length > 0) {
        secondaryReferrer = secondaryReferrerResult[0];
        // 3% commission for second level
        referralFeeLevel2 = totalAmount * 0.03;
      }
    }

    // 4. Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        status: 'pending',
        total_amount: totalAmount.toString(),
        referral_fee_level_1: referralFeeLevel1?.toString() || null,
        referral_fee_level_2: referralFeeLevel2?.toString() || null,
        shipping_address: input.shipping_address || null
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // 5. Create order items
    const orderItemInserts = orderItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price.toString(),
      total_price: item.total_price.toString()
    }));

    await db.insert(orderItemsTable)
      .values(orderItemInserts)
      .execute();

    // 6. Update inventory for physical products
    for (const item of orderItems) {
      if (item.product.type === 'physical') {
        await db.update(productsTable)
          .set({
            stock_quantity: item.product.stock_quantity - item.quantity,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
      }
    }

    // 7. Create referral commission records
    const commissions = [];

    if (referrer) {
      commissions.push({
        distributor_id: referrer.id,
        order_id: order.id,
        level: 1,
        commission_percentage: 5.0,
        commission_amount: referralFeeLevel1!
      });
    }

    if (secondaryReferrer) {
      commissions.push({
        distributor_id: secondaryReferrer.id,
        order_id: order.id,
        level: 2,
        commission_percentage: 3.0,
        commission_amount: referralFeeLevel2!
      });
    }

    if (commissions.length > 0) {
      const commissionInserts = commissions.map(comm => ({
        distributor_id: comm.distributor_id,
        order_id: comm.order_id,
        level: comm.level,
        commission_percentage: comm.commission_percentage.toString(),
        commission_amount: comm.commission_amount.toString()
      }));

      await db.insert(referralCommissionsTable)
        .values(commissionInserts)
        .execute();
    }

    // Return the order with converted numeric fields
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      referral_fee_level_1: order.referral_fee_level_1 ? parseFloat(order.referral_fee_level_1) : null,
      referral_fee_level_2: order.referral_fee_level_2 ? parseFloat(order.referral_fee_level_2) : null
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
};