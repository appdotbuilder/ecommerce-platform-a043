import { db } from '../db';
import { referralCommissionsTable } from '../db/schema';
import { type GetReferralCommissionsInput, type ReferralCommission } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getReferralCommissions = async (input: GetReferralCommissionsInput): Promise<ReferralCommission[]> => {
  try {
    // Apply pagination defaults
    const limit = input.limit ?? 50; // Default limit
    const offset = input.offset ?? 0; // Default offset

    // Build the complete query in one go
    const results = await db.select()
      .from(referralCommissionsTable)
      .where(eq(referralCommissionsTable.distributor_id, input.distributor_id))
      .orderBy(desc(referralCommissionsTable.created_at)) // Most recent first
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(commission => ({
      ...commission,
      commission_percentage: parseFloat(commission.commission_percentage),
      commission_amount: parseFloat(commission.commission_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch referral commissions:', error);
    throw error;
  }
};