import { db } from '../db';
import { addressesTable, usersTable } from '../db/schema';
import { type CreateAddressInput, type UpdateAddressInput, type GetUserAddressesInput, type Address } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export const createAddress = async (input: CreateAddressInput): Promise<Address> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // If this address is being set as default, unset existing default addresses
    if (input.is_default) {
      await db.update(addressesTable)
        .set({ is_default: false })
        .where(eq(addressesTable.user_id, input.user_id))
        .execute();
    }

    // Create the new address
    const result = await db.insert(addressesTable)
      .values({
        user_id: input.user_id,
        recipient_name: input.recipient_name,
        phone: input.phone,
        province: input.province,
        city: input.city,
        district: input.district,
        street_address: input.street_address,
        postal_code: input.postal_code,
        is_default: input.is_default
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address creation failed:', error);
    throw error;
  }
};

export const updateAddress = async (input: UpdateAddressInput): Promise<Address> => {
  try {
    // First, get the existing address to verify it exists and get user_id
    const existingAddress = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, input.id))
      .execute();
    
    if (existingAddress.length === 0) {
      throw new Error(`Address with id ${input.id} not found`);
    }

    const currentAddress = existingAddress[0];

    // If setting as default, unset other default addresses for this user
    if (input.is_default === true) {
      await db.update(addressesTable)
        .set({ is_default: false })
        .where(eq(addressesTable.user_id, currentAddress.user_id))
        .execute();
    }

    // Build update values, only including fields that are provided
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.recipient_name !== undefined) updateValues.recipient_name = input.recipient_name;
    if (input.phone !== undefined) updateValues.phone = input.phone;
    if (input.province !== undefined) updateValues.province = input.province;
    if (input.city !== undefined) updateValues.city = input.city;
    if (input.district !== undefined) updateValues.district = input.district;
    if (input.street_address !== undefined) updateValues.street_address = input.street_address;
    if (input.postal_code !== undefined) updateValues.postal_code = input.postal_code;
    if (input.is_default !== undefined) updateValues.is_default = input.is_default;

    // Update the address
    const result = await db.update(addressesTable)
      .set(updateValues)
      .where(eq(addressesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address update failed:', error);
    throw error;
  }
};

export const getUserAddresses = async (input: GetUserAddressesInput): Promise<Address[]> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Get all addresses for the user, ordered by default first, then by creation date
    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.user_id, input.user_id))
      .orderBy(desc(addressesTable.is_default), addressesTable.created_at)
      .execute();

    return addresses;
  } catch (error) {
    console.error('Get user addresses failed:', error);
    throw error;
  }
};

export const deleteAddress = async (id: number): Promise<boolean> => {
  try {
    const result = await db.delete(addressesTable)
      .where(eq(addressesTable.id, id))
      .returning()
      .execute();
    
    return result.length > 0;
  } catch (error) {
    console.error('Address deletion failed:', error);
    throw error;
  }
};

export const setDefaultAddress = async (userId: number, addressId: number): Promise<Address> => {
  try {
    // Verify the address exists and belongs to the user
    const targetAddress = await db.select()
      .from(addressesTable)
      .where(and(
        eq(addressesTable.id, addressId),
        eq(addressesTable.user_id, userId)
      ))
      .execute();
    
    if (targetAddress.length === 0) {
      throw new Error(`Address with id ${addressId} not found for user ${userId}`);
    }

    // Unset all default addresses for this user
    await db.update(addressesTable)
      .set({ is_default: false })
      .where(eq(addressesTable.user_id, userId))
      .execute();

    // Set the target address as default
    const result = await db.update(addressesTable)
      .set({ 
        is_default: true,
        updated_at: new Date()
      })
      .where(eq(addressesTable.id, addressId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Set default address failed:', error);
    throw error;
  }
};