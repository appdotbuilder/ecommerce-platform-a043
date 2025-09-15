import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ordersTable, referralCommissionsTable } from '../db/schema';
import { type GetReferralCommissionsInput } from '../schema';
import { getReferralCommissions } from '../handlers/get_referral_commissions';

describe('getReferralCommissions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch referral commissions for a distributor', async () => {
    // Create test distributor
    const [distributor] = await db.insert(usersTable)
      .values({
        email: 'distributor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Distributor',
        role: 'distributor'
      })
      .returning()
      .execute();

    // Create test user (customer)
    const [user] = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Customer',
        role: 'user',
        referrer_id: distributor.id
      })
      .returning()
      .execute();

    // Create test order
    const [order] = await db.insert(ordersTable)
      .values({
        user_id: user.id,
        status: 'delivered',
        total_amount: '100.00',
        referral_fee_level_1: '10.00'
      })
      .returning()
      .execute();

    // Create referral commission
    const [commission] = await db.insert(referralCommissionsTable)
      .values({
        distributor_id: distributor.id,
        order_id: order.id,
        level: 1,
        commission_percentage: '10.00',
        commission_amount: '10.00'
      })
      .returning()
      .execute();

    const input: GetReferralCommissionsInput = {
      distributor_id: distributor.id
    };

    const result = await getReferralCommissions(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(commission.id);
    expect(result[0].distributor_id).toEqual(distributor.id);
    expect(result[0].order_id).toEqual(order.id);
    expect(result[0].level).toEqual(1);
    expect(result[0].commission_percentage).toEqual(10.00);
    expect(typeof result[0].commission_percentage).toBe('number');
    expect(result[0].commission_amount).toEqual(10.00);
    expect(typeof result[0].commission_amount).toBe('number');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when distributor has no commissions', async () => {
    // Create test distributor with no commissions
    const [distributor] = await db.insert(usersTable)
      .values({
        email: 'distributor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Distributor',
        role: 'distributor'
      })
      .returning()
      .execute();

    const input: GetReferralCommissionsInput = {
      distributor_id: distributor.id
    };

    const result = await getReferralCommissions(input);

    expect(result).toHaveLength(0);
  });

  it('should support pagination with limit and offset', async () => {
    // Create test distributor
    const [distributor] = await db.insert(usersTable)
      .values({
        email: 'distributor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Distributor',
        role: 'distributor'
      })
      .returning()
      .execute();

    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Customer',
        role: 'user',
        referrer_id: distributor.id
      })
      .returning()
      .execute();

    // Create multiple test orders and commissions
    const orderPromises = [];
    for (let i = 1; i <= 5; i++) {
      orderPromises.push(
        db.insert(ordersTable)
          .values({
            user_id: user.id,
            status: 'delivered',
            total_amount: `${i * 10}.00`,
            referral_fee_level_1: `${i}.00`
          })
          .returning()
          .execute()
      );
    }

    const orders = await Promise.all(orderPromises);

    // Create commissions for each order
    const commissionPromises = orders.map(([order], index) =>
      db.insert(referralCommissionsTable)
        .values({
          distributor_id: distributor.id,
          order_id: order.id,
          level: 1,
          commission_percentage: '10.00',
          commission_amount: `${index + 1}.00`
        })
        .returning()
        .execute()
    );

    await Promise.all(commissionPromises);

    // Test pagination - get first 2 commissions
    const input: GetReferralCommissionsInput = {
      distributor_id: distributor.id,
      limit: 2,
      offset: 0
    };

    const result = await getReferralCommissions(input);

    expect(result).toHaveLength(2);
    
    // Verify results are ordered by created_at desc (most recent first)
    expect(result[0].created_at >= result[1].created_at).toBe(true);

    // Test offset
    const inputWithOffset: GetReferralCommissionsInput = {
      distributor_id: distributor.id,
      limit: 2,
      offset: 2
    };

    const offsetResult = await getReferralCommissions(inputWithOffset);
    expect(offsetResult).toHaveLength(2);
    
    // Verify different results (no overlap)
    expect(result[0].id).not.toEqual(offsetResult[0].id);
    expect(result[1].id).not.toEqual(offsetResult[1].id);
  });

  it('should handle multiple commission levels correctly', async () => {
    // Create test distributors (2 levels)
    const [level1Distributor] = await db.insert(usersTable)
      .values({
        email: 'level1@test.com',
        password_hash: 'hashed_password',
        first_name: 'Level1',
        last_name: 'Distributor',
        role: 'distributor'
      })
      .returning()
      .execute();

    const [level2Distributor] = await db.insert(usersTable)
      .values({
        email: 'level2@test.com',
        password_hash: 'hashed_password',
        first_name: 'Level2',
        last_name: 'Distributor',
        role: 'distributor',
        referrer_id: level1Distributor.id
      })
      .returning()
      .execute();

    // Create customer referred by level2 distributor
    const [customer] = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Customer',
        role: 'user',
        referrer_id: level2Distributor.id,
        secondary_referrer_id: level1Distributor.id
      })
      .returning()
      .execute();

    // Create order
    const [order] = await db.insert(ordersTable)
      .values({
        user_id: customer.id,
        status: 'delivered',
        total_amount: '200.00',
        referral_fee_level_1: '20.00',
        referral_fee_level_2: '10.00'
      })
      .returning()
      .execute();

    // Create commissions for both levels
    await db.insert(referralCommissionsTable)
      .values([
        {
          distributor_id: level2Distributor.id,
          order_id: order.id,
          level: 1,
          commission_percentage: '10.00',
          commission_amount: '20.00'
        },
        {
          distributor_id: level1Distributor.id,
          order_id: order.id,
          level: 2,
          commission_percentage: '5.00',
          commission_amount: '10.00'
        }
      ])
      .execute();

    // Test level 1 distributor commissions
    const level1Input: GetReferralCommissionsInput = {
      distributor_id: level1Distributor.id
    };

    const level1Result = await getReferralCommissions(level1Input);
    expect(level1Result).toHaveLength(1);
    expect(level1Result[0].level).toEqual(2);
    expect(level1Result[0].commission_amount).toEqual(10.00);

    // Test level 2 distributor commissions
    const level2Input: GetReferralCommissionsInput = {
      distributor_id: level2Distributor.id
    };

    const level2Result = await getReferralCommissions(level2Input);
    expect(level2Result).toHaveLength(1);
    expect(level2Result[0].level).toEqual(1);
    expect(level2Result[0].commission_amount).toEqual(20.00);
  });

  it('should apply default pagination values when not provided', async () => {
    // Create test distributor
    const [distributor] = await db.insert(usersTable)
      .values({
        email: 'distributor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Distributor',
        role: 'distributor'
      })
      .returning()
      .execute();

    // Input without pagination parameters
    const input: GetReferralCommissionsInput = {
      distributor_id: distributor.id
    };

    // Should not throw error and should handle defaults
    const result = await getReferralCommissions(input);
    expect(result).toBeInstanceOf(Array);
  });
});