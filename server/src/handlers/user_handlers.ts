import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type GetUserByIdInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password with salt
    const salt = randomBytes(16).toString('hex');
    const password_hash = salt + ':' + createHash('sha256').update(salt + input.password).digest('hex');

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        phone: input.phone,
        password_hash,
        role: input.role,
        avatar_url: input.avatar_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // Build update values object, only including defined fields
    const updateValues: any = {};
    if (input.username !== undefined) updateValues.username = input.username;
    if (input.email !== undefined) updateValues.email = input.email;
    if (input.phone !== undefined) updateValues.phone = input.phone;
    if (input.avatar_url !== undefined) updateValues.avatar_url = input.avatar_url;
    
    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    const result = await db.update(usersTable)
      .set(updateValues)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};

export const getUserById = async (input: GetUserByIdInput): Promise<User | null> => {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
};

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const result = await db.select()
      .from(usersTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
};