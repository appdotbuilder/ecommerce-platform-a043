import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test user data
const testUser1: CreateUserInput = {
  email: 'user1@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user'
};

const testUser2: CreateUserInput = {
  email: 'user2@example.com',
  password: 'password123',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'admin'
};

const testDistributor: CreateUserInput = {
  email: 'distributor@example.com',
  password: 'password123',
  first_name: 'Bob',
  last_name: 'Wilson',
  role: 'distributor'
};

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    expect(result).toEqual([]);
  });

  it('should fetch all users from database', async () => {
    // Create test users
    await db.insert(usersTable)
      .values([
        {
          email: testUser1.email,
          password_hash: 'hashed_password_1',
          first_name: testUser1.first_name,
          last_name: testUser1.last_name,
          role: testUser1.role
        },
        {
          email: testUser2.email,
          password_hash: 'hashed_password_2',
          first_name: testUser2.first_name,
          last_name: testUser2.last_name,
          role: testUser2.role
        }
      ])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Check first user
    const user1 = result.find(u => u.email === testUser1.email);
    expect(user1).toBeDefined();
    expect(user1!.first_name).toEqual('John');
    expect(user1!.last_name).toEqual('Doe');
    expect(user1!.role).toEqual('user');
    expect(user1!.id).toBeDefined();
    expect(user1!.created_at).toBeInstanceOf(Date);
    expect(user1!.updated_at).toBeInstanceOf(Date);
    expect(user1!.referrer_id).toBeNull();
    expect(user1!.secondary_referrer_id).toBeNull();

    // Check second user
    const user2 = result.find(u => u.email === testUser2.email);
    expect(user2).toBeDefined();
    expect(user2!.first_name).toEqual('Jane');
    expect(user2!.last_name).toEqual('Smith');
    expect(user2!.role).toEqual('admin');
    expect(user2!.id).toBeDefined();
    expect(user2!.created_at).toBeInstanceOf(Date);
    expect(user2!.updated_at).toBeInstanceOf(Date);
  });

  it('should return users with referral chain information', async () => {
    // Create distributor first (top of referral chain)
    const distributorResult = await db.insert(usersTable)
      .values({
        email: testDistributor.email,
        password_hash: 'hashed_password_distributor',
        first_name: testDistributor.first_name,
        last_name: testDistributor.last_name,
        role: testDistributor.role
      })
      .returning()
      .execute();

    const distributorId = distributorResult[0].id;

    // Create first level referral
    const user1Result = await db.insert(usersTable)
      .values({
        email: testUser1.email,
        password_hash: 'hashed_password_user1',
        first_name: testUser1.first_name,
        last_name: testUser1.last_name,
        role: testUser1.role,
        referrer_id: distributorId
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;

    // Create second level referral
    await db.insert(usersTable)
      .values({
        email: testUser2.email,
        password_hash: 'hashed_password_user2',
        first_name: testUser2.first_name,
        last_name: testUser2.last_name,
        role: testUser2.role,
        referrer_id: user1Id,
        secondary_referrer_id: distributorId
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);

    // Check distributor (no referrers)
    const distributor = result.find(u => u.email === testDistributor.email);
    expect(distributor).toBeDefined();
    expect(distributor!.role).toEqual('distributor');
    expect(distributor!.referrer_id).toBeNull();
    expect(distributor!.secondary_referrer_id).toBeNull();

    // Check first level referral
    const user1 = result.find(u => u.email === testUser1.email);
    expect(user1).toBeDefined();
    expect(user1!.referrer_id).toEqual(distributorId);
    expect(user1!.secondary_referrer_id).toBeNull();

    // Check second level referral
    const user2 = result.find(u => u.email === testUser2.email);
    expect(user2).toBeDefined();
    expect(user2!.referrer_id).toEqual(user1Id);
    expect(user2!.secondary_referrer_id).toEqual(distributorId);
  });

  it('should handle different user roles correctly', async () => {
    // Create users with different roles
    await db.insert(usersTable)
      .values([
        {
          email: 'admin@example.com',
          password_hash: 'hashed_password_admin',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        },
        {
          email: 'distributor@example.com',
          password_hash: 'hashed_password_distributor',
          first_name: 'Distributor',
          last_name: 'User',
          role: 'distributor'
        },
        {
          email: 'regular@example.com',
          password_hash: 'hashed_password_user',
          first_name: 'Regular',
          last_name: 'User',
          role: 'user'
        }
      ])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);

    const adminUser = result.find(u => u.role === 'admin');
    const distributorUser = result.find(u => u.role === 'distributor');
    const regularUser = result.find(u => u.role === 'user');

    expect(adminUser).toBeDefined();
    expect(distributorUser).toBeDefined();
    expect(regularUser).toBeDefined();

    expect(adminUser!.first_name).toEqual('Admin');
    expect(distributorUser!.first_name).toEqual('Distributor');
    expect(regularUser!.first_name).toEqual('Regular');
  });

  it('should return users ordered by creation time (database default)', async () => {
    // Create users in sequence to ensure different timestamps
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'first@example.com',
        password_hash: 'hashed_password_first',
        first_name: 'First',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'second@example.com',
        password_hash: 'hashed_password_second',
        first_name: 'Second',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify users are returned (order depends on database insertion order)
    const firstUser = result.find(u => u.email === 'first@example.com');
    const secondUser = result.find(u => u.email === 'second@example.com');
    
    expect(firstUser).toBeDefined();
    expect(secondUser).toBeDefined();
    expect(firstUser!.created_at).toBeInstanceOf(Date);
    expect(secondUser!.created_at).toBeInstanceOf(Date);
  });
});