import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';

export const getUsers = async (): Promise<User[]> => {
  try {
    // Fetch all users from the database
    const results = await db.select()
      .from(usersTable)
      .execute();

    // Convert the results to match the schema type
    // Handle any numeric conversions if needed (none in users table currently)
    return results.map(user => ({
      ...user,
      // Ensure dates are properly converted
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};