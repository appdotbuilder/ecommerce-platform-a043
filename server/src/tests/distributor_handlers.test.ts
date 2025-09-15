import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, distributorsTable, commissionsTable, ordersTable } from '../db/schema';
import { type CreateDistributorInput, type UpdateDistributorInput, type GetDistributorCommissionsInput } from '../schema';
import { 
  createDistributor, 
  updateDistributor, 
  getDistributorByUserId, 
  getDistributorByReferralCode, 
  getDistributorCommissions,
  createCommission,
  payCommission,
  getAllDistributors 
} from '../handlers/distributor_handlers';
import { eq, and } from 'drizzle-orm';
// Test data
const testUser = {
  username: 'test_distributor',
  email: 'distributor@test.com',
  phone: '1234567890',
  password_hash: 'hashed_password_123',
  role: 'consumer' as const
};

const testDistributorInput: CreateDistributorInput = {
  user_id: 0, // Will be set after user creation
  commission_rate: 0.15
};

describe('Distributor Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createDistributor', () => {
    it('should create a distributor successfully', async () => {
      // Create test user first
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const userId = userResult[0].id;
      const input = { ...testDistributorInput, user_id: userId };

      const result = await createDistributor(input);

      // Verify distributor properties
      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(userId);
      expect(result.commission_rate).toEqual(0.15);
      expect(result.total_earnings).toEqual(0);
      expect(result.status).toEqual('active');
      expect(result.referral_code).toMatch(/^REF\d+[A-Z0-9]{4}$/);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify saved to database
      const distributors = await db.select()
        .from(distributorsTable)
        .where(eq(distributorsTable.id, result.id))
        .execute();

      expect(distributors).toHaveLength(1);
      expect(distributors[0].user_id).toEqual(userId);
      expect(parseFloat(distributors[0].commission_rate)).toEqual(0.15);
    });

    it('should throw error if user does not exist', async () => {
      const input = { ...testDistributorInput, user_id: 999 };

      await expect(createDistributor(input)).rejects.toThrow(/User with id 999 not found/i);
    });

    it('should throw error if user already has distributor account', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const userId = userResult[0].id;
      const input = { ...testDistributorInput, user_id: userId };

      // Create first distributor
      await createDistributor(input);

      // Try to create second distributor for same user
      await expect(createDistributor(input)).rejects.toThrow(/already has a distributor account/i);
    });

    it('should generate unique referral codes', async () => {
      // Create multiple users
      const user1Result = await db.insert(usersTable)
        .values({ ...testUser, username: 'user1', email: 'user1@test.com' })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({ ...testUser, username: 'user2', email: 'user2@test.com' })
        .returning()
        .execute();

      const distributor1 = await createDistributor({ user_id: user1Result[0].id, commission_rate: 0.1 });
      const distributor2 = await createDistributor({ user_id: user2Result[0].id, commission_rate: 0.2 });

      expect(distributor1.referral_code).not.toEqual(distributor2.referral_code);
    });
  });

  describe('updateDistributor', () => {
    it('should update distributor commission rate and status', async () => {
      // Create test user and distributor
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      const updateInput: UpdateDistributorInput = {
        id: distributor.id,
        commission_rate: 0.25,
        status: 'inactive'
      };

      const result = await updateDistributor(updateInput);

      expect(result.id).toEqual(distributor.id);
      expect(result.commission_rate).toEqual(0.25);
      expect(result.status).toEqual('inactive');
      expect(result.updated_at.getTime()).toBeGreaterThan(distributor.updated_at.getTime());
    });

    it('should throw error if distributor does not exist', async () => {
      const input: UpdateDistributorInput = {
        id: 999,
        commission_rate: 0.2
      };

      await expect(updateDistributor(input)).rejects.toThrow(/Distributor with id 999 not found/i);
    });

    it('should update only provided fields', async () => {
      // Create test user and distributor
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      // Update only status
      const result = await updateDistributor({
        id: distributor.id,
        status: 'suspended'
      });

      expect(result.commission_rate).toEqual(0.1); // Should remain unchanged
      expect(result.status).toEqual('suspended');
    });
  });

  describe('getDistributorByUserId', () => {
    it('should return distributor for existing user', async () => {
      // Create test user and distributor
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const createdDistributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.15 
      });

      const result = await getDistributorByUserId(userResult[0].id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdDistributor.id);
      expect(result!.user_id).toEqual(userResult[0].id);
      expect(result!.commission_rate).toEqual(0.15);
    });

    it('should return null for non-existent user', async () => {
      const result = await getDistributorByUserId(999);
      expect(result).toBeNull();
    });
  });

  describe('getDistributorByReferralCode', () => {
    it('should return distributor for existing referral code', async () => {
      // Create test user and distributor
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const createdDistributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.2 
      });

      const result = await getDistributorByReferralCode(createdDistributor.referral_code);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdDistributor.id);
      expect(result!.referral_code).toEqual(createdDistributor.referral_code);
    });

    it('should return null for non-existent referral code', async () => {
      const result = await getDistributorByReferralCode('INVALID_CODE');
      expect(result).toBeNull();
    });
  });

  describe('createCommission', () => {
    it('should create commission successfully', async () => {
      // Create test user, distributor, and order
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD001',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      const result = await createCommission(
        distributor.id, 
        orderResult[0].id, 
        10.00, 
        0.1
      );

      expect(result.id).toBeDefined();
      expect(result.distributor_id).toEqual(distributor.id);
      expect(result.order_id).toEqual(orderResult[0].id);
      expect(result.commission_amount).toEqual(10.00);
      expect(result.commission_rate).toEqual(0.1);
      expect(result.status).toEqual('pending');
      expect(result.paid_at).toBeNull();
    });

    it('should throw error if distributor does not exist', async () => {
      // Create test user and order
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD002',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      await expect(createCommission(999, orderResult[0].id, 10.00, 0.1))
        .rejects.toThrow(/Distributor with id 999 not found/i);
    });

    it('should throw error if order does not exist', async () => {
      // Create test user and distributor
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      await expect(createCommission(distributor.id, 999, 10.00, 0.1))
        .rejects.toThrow(/Order with id 999 not found/i);
    });

    it('should throw error if commission already exists', async () => {
      // Create test user, distributor, and order
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD003',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      // Create first commission
      await createCommission(distributor.id, orderResult[0].id, 10.00, 0.1);

      // Try to create duplicate
      await expect(createCommission(distributor.id, orderResult[0].id, 10.00, 0.1))
        .rejects.toThrow(/Commission already exists/i);
    });
  });

  describe('payCommission', () => {
    it('should pay commission and update distributor earnings', async () => {
      // Create test user, distributor, order, and commission
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD004',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      const commission = await createCommission(distributor.id, orderResult[0].id, 15.00, 0.1);

      const result = await payCommission(commission.id);

      expect(result.id).toEqual(commission.id);
      expect(result.status).toEqual('paid');
      expect(result.paid_at).toBeInstanceOf(Date);

      // Verify distributor earnings updated
      const updatedDistributor = await getDistributorByUserId(userResult[0].id);
      expect(updatedDistributor!.total_earnings).toEqual(15.00);
    });

    it('should throw error if commission does not exist', async () => {
      await expect(payCommission(999)).rejects.toThrow(/Commission with id 999 not found/i);
    });

    it('should throw error if commission already paid', async () => {
      // Create test user, distributor, order, and commission
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD005',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      const commission = await createCommission(distributor.id, orderResult[0].id, 10.00, 0.1);

      // Pay commission first time
      await payCommission(commission.id);

      // Try to pay again
      await expect(payCommission(commission.id)).rejects.toThrow(/already paid/i);
    });
  });

  describe('getDistributorCommissions', () => {
    it('should return paginated commissions for distributor', async () => {
      // Create test user, distributor, and orders with commissions
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      // Create multiple orders and commissions
      for (let i = 0; i < 3; i++) {
        const orderResult = await db.insert(ordersTable)
          .values({
            user_id: userResult[0].id,
            order_number: `ORD00${i + 6}`,
            total_amount: '100.00',
            final_amount: '100.00',
            shipping_address: 'Test Address'
          })
          .returning()
          .execute();

        await createCommission(distributor.id, orderResult[0].id, 10.00, 0.1);
      }

      const input: GetDistributorCommissionsInput = {
        distributor_id: distributor.id,
        page: 1,
        limit: 20
      };

      const result = await getDistributorCommissions(input);

      expect(result.commissions).toHaveLength(3);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(20);

      // Verify commission data
      result.commissions.forEach(commission => {
        expect(commission.distributor_id).toEqual(distributor.id);
        expect(commission.commission_amount).toEqual(10.00);
        expect(commission.status).toEqual('pending');
      });
    });

    it('should filter commissions by status', async () => {
      // Create test user, distributor, and orders
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const distributor = await createDistributor({ 
        user_id: userResult[0].id, 
        commission_rate: 0.1 
      });

      // Create orders and commissions
      const orderResult1 = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD009',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      const orderResult2 = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORD010',
          total_amount: '100.00',
          final_amount: '100.00',
          shipping_address: 'Test Address'
        })
        .returning()
        .execute();

      const commission1 = await createCommission(distributor.id, orderResult1[0].id, 10.00, 0.1);
      const commission2 = await createCommission(distributor.id, orderResult2[0].id, 15.00, 0.1);

      // Pay one commission
      await payCommission(commission1.id);

      // Filter for paid commissions only
      const result = await getDistributorCommissions({
        distributor_id: distributor.id,
        status: 'paid',
        page: 1,
        limit: 20
      });

      expect(result.commissions).toHaveLength(1);
      expect(result.commissions[0].id).toEqual(commission1.id);
      expect(result.commissions[0].status).toEqual('paid');
    });

    it('should return empty results for non-existent distributor', async () => {
      const result = await getDistributorCommissions({
        distributor_id: 999,
        page: 1,
        limit: 20
      });

      expect(result.commissions).toHaveLength(0);
      expect(result.total).toEqual(0);
    });
  });

  describe('getAllDistributors', () => {
    it('should return all distributors ordered by creation date', async () => {
      // Create multiple users and distributors
      const user1Result = await db.insert(usersTable)
        .values({ ...testUser, username: 'dist1', email: 'dist1@test.com' })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({ ...testUser, username: 'dist2', email: 'dist2@test.com' })
        .returning()
        .execute();

      await createDistributor({ user_id: user1Result[0].id, commission_rate: 0.1 });
      await createDistributor({ user_id: user2Result[0].id, commission_rate: 0.2 });

      const result = await getAllDistributors();

      expect(result).toHaveLength(2);
      expect(result[0].commission_rate).toEqual(0.2); // Most recent first
      expect(result[1].commission_rate).toEqual(0.1);

      // Verify numeric conversions
      result.forEach(distributor => {
        expect(typeof distributor.commission_rate).toBe('number');
        expect(typeof distributor.total_earnings).toBe('number');
      });
    });

    it('should return empty array when no distributors exist', async () => {
      const result = await getAllDistributors();
      expect(result).toHaveLength(0);
    });
  });
});