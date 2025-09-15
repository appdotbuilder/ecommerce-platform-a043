import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type GetUserByIdInput } from '../schema';
import { createUser, updateUser, getUserById, getAllUsers } from '../handlers/user_handlers';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Test inputs
const testCreateUserInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  phone: '+1234567890',
  password: 'password123',
  role: 'consumer',
  avatar_url: 'https://example.com/avatar.jpg'
};

const testCreateUserInputMinimal: CreateUserInput = {
  username: 'minimaluser',
  email: 'minimal@example.com',
  phone: null,
  password: 'password123',
  role: 'consumer',
  avatar_url: null
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testCreateUserInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.phone).toEqual('+1234567890');
    expect(result.role).toEqual('consumer');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123'); // Should be hashed
  });

  it('should create a user with minimal fields', async () => {
    const result = await createUser(testCreateUserInputMinimal);

    expect(result.username).toEqual('minimaluser');
    expect(result.email).toEqual('minimal@example.com');
    expect(result.phone).toBeNull();
    expect(result.role).toEqual('consumer');
    expect(result.avatar_url).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.password_hash).toBeDefined();
  });

  it('should hash the password correctly', async () => {
    const result = await createUser(testCreateUserInput);
    
    // Verify password is hashed and not stored in plain text
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(20);
    expect(result.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/); // salt:hash pattern
  });

  it('should save user to database', async () => {
    const result = await createUser(testCreateUserInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].phone).toEqual('+1234567890');
    expect(users[0].role).toEqual('consumer');
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should create admin user', async () => {
    const adminInput: CreateUserInput = {
      ...testCreateUserInput,
      username: 'adminuser',
      email: 'admin@example.com',
      role: 'admin'
    };

    const result = await createUser(adminInput);
    expect(result.role).toEqual('admin');
  });

  it('should reject duplicate username', async () => {
    await createUser(testCreateUserInput);
    
    const duplicateInput: CreateUserInput = {
      ...testCreateUserInput,
      email: 'different@example.com'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should reject duplicate email', async () => {
    await createUser(testCreateUserInput);
    
    const duplicateInput: CreateUserInput = {
      ...testCreateUserInput,
      username: 'differentuser'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });
});

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user fields', async () => {
    // Create a user first
    const createdUser = await createUser(testCreateUserInput);

    const updateInput: UpdateUserInput = {
      id: createdUser.id,
      username: 'updateduser',
      email: 'updated@example.com',
      phone: '+0987654321',
      avatar_url: 'https://example.com/new-avatar.jpg'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(createdUser.id);
    expect(result.username).toEqual('updateduser');
    expect(result.email).toEqual('updated@example.com');
    expect(result.phone).toEqual('+0987654321');
    expect(result.avatar_url).toEqual('https://example.com/new-avatar.jpg');
    expect(result.role).toEqual('consumer'); // Should remain unchanged
    expect(result.password_hash).toEqual(createdUser.password_hash); // Should remain unchanged
    expect(result.updated_at > createdUser.updated_at).toBe(true); // Should be updated
  });

  it('should update only specified fields', async () => {
    const createdUser = await createUser(testCreateUserInput);

    const partialUpdateInput: UpdateUserInput = {
      id: createdUser.id,
      username: 'partiallyupdated'
    };

    const result = await updateUser(partialUpdateInput);

    expect(result.username).toEqual('partiallyupdated');
    expect(result.email).toEqual(createdUser.email); // Should remain unchanged
    expect(result.phone).toEqual(createdUser.phone); // Should remain unchanged
    expect(result.avatar_url).toEqual(createdUser.avatar_url); // Should remain unchanged
  });

  it('should update nullable fields to null', async () => {
    const createdUser = await createUser(testCreateUserInput);

    const updateInput: UpdateUserInput = {
      id: createdUser.id,
      phone: null,
      avatar_url: null
    };

    const result = await updateUser(updateInput);

    expect(result.phone).toBeNull();
    expect(result.avatar_url).toBeNull();
    expect(result.username).toEqual(createdUser.username); // Should remain unchanged
  });

  it('should save updated user to database', async () => {
    const createdUser = await createUser(testCreateUserInput);

    const updateInput: UpdateUserInput = {
      id: createdUser.id,
      username: 'dbtest'
    };

    await updateUser(updateInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('dbtest');
    expect(users[0].updated_at > createdUser.updated_at).toBe(true);
  });

  it('should throw error for non-existent user', async () => {
    const updateInput: UpdateUserInput = {
      id: 999999,
      username: 'nonexistent'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User with id 999999 not found/);
  });
});

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve user by id', async () => {
    const createdUser = await createUser(testCreateUserInput);

    const getUserInput: GetUserByIdInput = {
      id: createdUser.id
    };

    const result = await getUserById(getUserInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.username).toEqual('testuser');
    expect(result!.email).toEqual('test@example.com');
    expect(result!.phone).toEqual('+1234567890');
    expect(result!.role).toEqual('consumer');
    expect(result!.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent user', async () => {
    const getUserInput: GetUserByIdInput = {
      id: 999999
    };

    const result = await getUserById(getUserInput);
    expect(result).toBeNull();
  });

  it('should retrieve user with minimal fields', async () => {
    const createdUser = await createUser(testCreateUserInputMinimal);

    const getUserInput: GetUserByIdInput = {
      id: createdUser.id
    };

    const result = await getUserById(getUserInput);

    expect(result).not.toBeNull();
    expect(result!.username).toEqual('minimaluser');
    expect(result!.phone).toBeNull();
    expect(result!.avatar_url).toBeNull();
  });
});

describe('getAllUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getAllUsers();
    expect(result).toHaveLength(0);
  });

  it('should retrieve all users', async () => {
    // Create multiple users
    const user1 = await createUser(testCreateUserInput);
    const user2 = await createUser({
      ...testCreateUserInputMinimal,
      username: 'user2',
      email: 'user2@example.com'
    });
    const user3 = await createUser({
      username: 'adminuser',
      email: 'admin@example.com',
      phone: null,
      password: 'adminpass',
      role: 'admin',
      avatar_url: null
    });

    const result = await getAllUsers();

    expect(result).toHaveLength(3);
    
    const userIds = result.map(user => user.id);
    expect(userIds).toContain(user1.id);
    expect(userIds).toContain(user2.id);
    expect(userIds).toContain(user3.id);

    const usernames = result.map(user => user.username);
    expect(usernames).toContain('testuser');
    expect(usernames).toContain('user2');
    expect(usernames).toContain('adminuser');

    // Verify all users have proper structure
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.password_hash).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should retrieve users with different roles', async () => {
    await createUser({
      ...testCreateUserInput,
      role: 'consumer'
    });
    await createUser({
      username: 'adminuser',
      email: 'admin@example.com',
      phone: null,
      password: 'adminpass',
      role: 'admin',
      avatar_url: null
    });

    const result = await getAllUsers();

    expect(result).toHaveLength(2);
    
    const roles = result.map(user => user.role);
    expect(roles).toContain('consumer');
    expect(roles).toContain('admin');
  });
});