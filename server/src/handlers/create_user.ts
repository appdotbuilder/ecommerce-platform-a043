import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password (simple hash for demo - in production use bcrypt or similar)
    const password_hash = await Bun.password.hash(input.password);

    let referrer_id = input.referrer_id || null;
    let secondary_referrer_id = null;

    // If a referrer is provided, validate it exists and set up referral chain
    if (referrer_id) {
      const referrer = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, referrer_id))
        .limit(1)
        .execute();

      if (referrer.length === 0) {
        throw new Error('Referrer not found');
      }

      // Set secondary referrer if the referrer has a referrer
      const referrerData = referrer[0];
      if (referrerData.referrer_id) {
        secondary_referrer_id = referrerData.referrer_id;
      }
    }

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        referrer_id,
        secondary_referrer_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};