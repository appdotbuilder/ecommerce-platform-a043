import { db } from '../db';
import { distributorsTable, commissionsTable, usersTable, ordersTable } from '../db/schema';
import { type CreateDistributorInput, type UpdateDistributorInput, type GetDistributorCommissionsInput, type Distributor, type Commission } from '../schema';
import { eq, and, SQL, desc, gte, count } from 'drizzle-orm';

export const createDistributor = async (input: CreateDistributorInput): Promise<Distributor> => {
  try {
    // Check if user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Check if user already has a distributor account
    const existingDistributor = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.user_id, input.user_id))
      .execute();

    if (existingDistributor.length > 0) {
      throw new Error(`User ${input.user_id} already has a distributor account`);
    }

    // Generate unique referral code
    const referralCode = `REF${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Insert distributor record
    const result = await db.insert(distributorsTable)
      .values({
        user_id: input.user_id,
        referral_code: referralCode,
        commission_rate: input.commission_rate.toString(),
        total_earnings: '0'
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const distributor = result[0];
    return {
      ...distributor,
      commission_rate: parseFloat(distributor.commission_rate),
      total_earnings: parseFloat(distributor.total_earnings)
    };
  } catch (error) {
    console.error('Distributor creation failed:', error);
    throw error;
  }
};

export const updateDistributor = async (input: UpdateDistributorInput): Promise<Distributor> => {
  try {
    // Check if distributor exists
    const existingDistributor = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.id, input.id))
      .execute();

    if (existingDistributor.length === 0) {
      throw new Error(`Distributor with id ${input.id} not found`);
    }

    // Build update values
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.commission_rate !== undefined) {
      updateValues.commission_rate = input.commission_rate.toString();
    }

    if (input.status !== undefined) {
      updateValues.status = input.status;
    }

    // Update distributor record
    const result = await db.update(distributorsTable)
      .set(updateValues)
      .where(eq(distributorsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const distributor = result[0];
    return {
      ...distributor,
      commission_rate: parseFloat(distributor.commission_rate),
      total_earnings: parseFloat(distributor.total_earnings)
    };
  } catch (error) {
    console.error('Distributor update failed:', error);
    throw error;
  }
};

export const getDistributorByUserId = async (userId: number): Promise<Distributor | null> => {
  try {
    const result = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.user_id, userId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers
    const distributor = result[0];
    return {
      ...distributor,
      commission_rate: parseFloat(distributor.commission_rate),
      total_earnings: parseFloat(distributor.total_earnings)
    };
  } catch (error) {
    console.error('Get distributor by user ID failed:', error);
    throw error;
  }
};

export const getDistributorByReferralCode = async (referralCode: string): Promise<Distributor | null> => {
  try {
    const result = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.referral_code, referralCode))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers
    const distributor = result[0];
    return {
      ...distributor,
      commission_rate: parseFloat(distributor.commission_rate),
      total_earnings: parseFloat(distributor.total_earnings)
    };
  } catch (error) {
    console.error('Get distributor by referral code failed:', error);
    throw error;
  }
};

export const getDistributorCommissions = async (input: GetDistributorCommissionsInput): Promise<{ commissions: Commission[]; total: number; page: number; limit: number }> => {
  try {
    // Build query conditions
    const conditions: SQL<unknown>[] = [
      eq(commissionsTable.distributor_id, input.distributor_id)
    ];

    if (input.status) {
      conditions.push(eq(commissionsTable.status, input.status));
    }

    // Get total count
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const totalResult = await db.select({ count: count() })
      .from(commissionsTable)
      .where(whereCondition)
      .execute();
    
    const total = totalResult[0].count;

    // Get paginated results
    const offset = (input.page - 1) * input.limit;
    
    const result = await db.select()
      .from(commissionsTable)
      .where(whereCondition)
      .orderBy(desc(commissionsTable.created_at))
      .limit(input.limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers
    const commissions = result.map(commission => ({
      ...commission,
      commission_amount: parseFloat(commission.commission_amount),
      commission_rate: parseFloat(commission.commission_rate)
    }));

    return {
      commissions,
      total,
      page: input.page,
      limit: input.limit
    };
  } catch (error) {
    console.error('Get distributor commissions failed:', error);
    throw error;
  }
};

export const createCommission = async (distributorId: number, orderId: number, commissionAmount: number, commissionRate: number): Promise<Commission> => {
  try {
    // Verify distributor exists
    const distributor = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.id, distributorId))
      .execute();

    if (distributor.length === 0) {
      throw new Error(`Distributor with id ${distributorId} not found`);
    }

    // Verify order exists
    const order = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (order.length === 0) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    // Check if commission already exists for this order
    const existingCommission = await db.select()
      .from(commissionsTable)
      .where(and(
        eq(commissionsTable.distributor_id, distributorId),
        eq(commissionsTable.order_id, orderId)
      ))
      .execute();

    if (existingCommission.length > 0) {
      throw new Error(`Commission already exists for distributor ${distributorId} and order ${orderId}`);
    }

    // Insert commission record
    const result = await db.insert(commissionsTable)
      .values({
        distributor_id: distributorId,
        order_id: orderId,
        commission_amount: commissionAmount.toString(),
        commission_rate: commissionRate.toString()
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const commission = result[0];
    return {
      ...commission,
      commission_amount: parseFloat(commission.commission_amount),
      commission_rate: parseFloat(commission.commission_rate)
    };
  } catch (error) {
    console.error('Commission creation failed:', error);
    throw error;
  }
};

export const payCommission = async (commissionId: number): Promise<Commission> => {
  try {
    // Get commission details
    const existingCommission = await db.select()
      .from(commissionsTable)
      .where(eq(commissionsTable.id, commissionId))
      .execute();

    if (existingCommission.length === 0) {
      throw new Error(`Commission with id ${commissionId} not found`);
    }

    const commission = existingCommission[0];

    // Check if already paid
    if (commission.status === 'paid') {
      throw new Error(`Commission ${commissionId} is already paid`);
    }

    // Update commission status to paid
    const updatedCommissionResult = await db.update(commissionsTable)
      .set({
        status: 'paid',
        paid_at: new Date()
      })
      .where(eq(commissionsTable.id, commissionId))
      .returning()
      .execute();

    // Update distributor total earnings
    const distributorId = commission.distributor_id;
    const commissionAmount = parseFloat(commission.commission_amount);

    const currentDistributor = await db.select()
      .from(distributorsTable)
      .where(eq(distributorsTable.id, distributorId))
      .execute();

    const currentEarnings = parseFloat(currentDistributor[0].total_earnings);
    const newTotalEarnings = currentEarnings + commissionAmount;

    await db.update(distributorsTable)
      .set({
        total_earnings: newTotalEarnings.toString(),
        updated_at: new Date()
      })
      .where(eq(distributorsTable.id, distributorId))
      .execute();

    // Convert numeric fields back to numbers and return
    const updatedCommission = updatedCommissionResult[0];
    return {
      ...updatedCommission,
      commission_amount: parseFloat(updatedCommission.commission_amount),
      commission_rate: parseFloat(updatedCommission.commission_rate)
    };
  } catch (error) {
    console.error('Commission payment failed:', error);
    throw error;
  }
};

export const getAllDistributors = async (): Promise<Distributor[]> => {
  try {
    const result = await db.select()
      .from(distributorsTable)
      .orderBy(desc(distributorsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return result.map(distributor => ({
      ...distributor,
      commission_rate: parseFloat(distributor.commission_rate),
      total_earnings: parseFloat(distributor.total_earnings)
    }));
  } catch (error) {
    console.error('Get all distributors failed:', error);
    throw error;
  }
};