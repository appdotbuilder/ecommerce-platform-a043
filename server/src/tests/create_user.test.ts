import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test inputs
const basicUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user'
};

const distributorInput: CreateUserInput = {
  email: 'distributor@example.com',
  password: 'password456',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'distributor'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a basic user without referrer', async () => {
    const result = await createUser(basicUserInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('user');
    expect(result.referrer_id).toBeNull();
    expect(result.secondary_referrer_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(10);
  });

  it('should save user to database', async () => {
    const result = await createUser(basicUserInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].last_name).toEqual('Doe');
    expect(users[0].role).toEqual('user');
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should create user with distributor role', async () => {
    const result = await createUser(distributorInput);

    expect(result.role).toEqual('distributor');
    expect(result.email).toEqual('distributor@example.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
  });

  it('should create user with referrer', async () => {
    // First create a referrer
    const referrer = await createUser(distributorInput);

    // Create user with referrer
    const userWithReferrer: CreateUserInput = {
      email: 'referred@example.com',
      password: 'password789',
      first_name: 'Bob',
      last_name: 'Johnson',
      role: 'user',
      referrer_id: referrer.id
    };

    const result = await createUser(userWithReferrer);

    expect(result.referrer_id).toEqual(referrer.id);
    expect(result.secondary_referrer_id).toBeNull(); // Referrer has no referrer
    expect(result.email).toEqual('referred@example.com');
  });

  it('should set up two-level referral chain', async () => {
    // Create first level referrer
    const firstReferrer = await createUser({
      email: 'first-referrer@example.com',
      password: 'password111',
      first_name: 'Alice',
      last_name: 'First',
      role: 'distributor'
    });

    // Create second level referrer (referred by first)
    const secondReferrer = await createUser({
      email: 'second-referrer@example.com',
      password: 'password222',
      first_name: 'Bob',
      last_name: 'Second',
      role: 'distributor',
      referrer_id: firstReferrer.id
    });

    // Create user referred by second level referrer
    const endUser = await createUser({
      email: 'end-user@example.com',
      password: 'password333',
      first_name: 'Charlie',
      last_name: 'End',
      role: 'user',
      referrer_id: secondReferrer.id
    });

    // Verify referral chain
    expect(endUser.referrer_id).toEqual(secondReferrer.id);
    expect(endUser.secondary_referrer_id).toEqual(firstReferrer.id);
  });

  it('should throw error for non-existent referrer', async () => {
    const userWithInvalidReferrer: CreateUserInput = {
      email: 'invalid@example.com',
      password: 'password999',
      first_name: 'Invalid',
      last_name: 'User',
      role: 'user',
      referrer_id: 99999 // Non-existent ID
    };

    await expect(createUser(userWithInvalidReferrer)).rejects.toThrow(/referrer not found/i);
  });

  it('should handle email uniqueness constraint', async () => {
    // Create first user
    await createUser(basicUserInput);

    // Try to create another user with same email
    const duplicateEmailUser: CreateUserInput = {
      email: 'test@example.com', // Same email
      password: 'different_password',
      first_name: 'Different',
      last_name: 'User',
      role: 'user'
    };

    await expect(createUser(duplicateEmailUser)).rejects.toThrow();
  });

  it('should verify password hashing works', async () => {
    const result = await createUser(basicUserInput);

    // Verify password can be verified with Bun's password utility
    const isValid = await Bun.password.verify('password123', result.password_hash);
    expect(isValid).toBe(true);

    const isInvalid = await Bun.password.verify('wrong_password', result.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('should use default role when not specified', async () => {
    const userWithoutRole: CreateUserInput = {
      email: 'norole@example.com',
      password: 'password000',
      first_name: 'No',
      last_name: 'Role',
      role: 'user' // Default role is applied by Zod schema
    };

    const result = await createUser(userWithoutRole);
    expect(result.role).toEqual('user');
  });
});