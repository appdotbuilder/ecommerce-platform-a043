import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, addressesTable } from '../db/schema';
import { type CreateAddressInput, type UpdateAddressInput, type GetUserAddressesInput } from '../schema';
import { 
  createAddress, 
  updateAddress, 
  getUserAddresses, 
  deleteAddress, 
  setDefaultAddress 
} from '../handlers/address_handlers';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  phone: '+1234567890',
  password_hash: 'hashedpassword',
  role: 'consumer' as const
};

// Test address data
const testAddressInput: CreateAddressInput = {
  user_id: 1,
  recipient_name: 'John Doe',
  phone: '+1234567890',
  province: 'California',
  city: 'Los Angeles',
  district: 'Hollywood',
  street_address: '123 Main Street',
  postal_code: '90210',
  is_default: false
};

describe('address handlers', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;
    testAddressInput.user_id = userId;
  });

  afterEach(resetDB);

  describe('createAddress', () => {
    it('should create an address successfully', async () => {
      const result = await createAddress(testAddressInput);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(userId);
      expect(result.recipient_name).toEqual('John Doe');
      expect(result.phone).toEqual('+1234567890');
      expect(result.province).toEqual('California');
      expect(result.city).toEqual('Los Angeles');
      expect(result.district).toEqual('Hollywood');
      expect(result.street_address).toEqual('123 Main Street');
      expect(result.postal_code).toEqual('90210');
      expect(result.is_default).toEqual(false);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save address to database', async () => {
      const result = await createAddress(testAddressInput);

      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.id, result.id))
        .execute();

      expect(addresses).toHaveLength(1);
      expect(addresses[0].recipient_name).toEqual('John Doe');
      expect(addresses[0].user_id).toEqual(userId);
    });

    it('should create address with default flag and unset other defaults', async () => {
      // Create first address as default
      const firstAddress = await createAddress({
        ...testAddressInput,
        is_default: true
      });

      // Create second address as default
      const secondAddress = await createAddress({
        ...testAddressInput,
        recipient_name: 'Jane Doe',
        is_default: true
      });

      // Check that only the second address is default
      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.user_id, userId))
        .execute();

      const firstAddressInDb = addresses.find(a => a.id === firstAddress.id);
      const secondAddressInDb = addresses.find(a => a.id === secondAddress.id);

      expect(firstAddressInDb?.is_default).toBe(false);
      expect(secondAddressInDb?.is_default).toBe(true);
    });

    it('should handle null postal_code', async () => {
      const result = await createAddress({
        ...testAddressInput,
        postal_code: null
      });

      expect(result.postal_code).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      expect(createAddress({
        ...testAddressInput,
        user_id: 99999
      })).rejects.toThrow(/User with id 99999 not found/i);
    });
  });

  describe('updateAddress', () => {
    let addressId: number;

    beforeEach(async () => {
      const address = await createAddress(testAddressInput);
      addressId = address.id;
    });

    it('should update address fields successfully', async () => {
      const updateInput: UpdateAddressInput = {
        id: addressId,
        recipient_name: 'Updated Name',
        city: 'Updated City',
        is_default: true
      };

      const result = await updateAddress(updateInput);

      expect(result.id).toEqual(addressId);
      expect(result.recipient_name).toEqual('Updated Name');
      expect(result.city).toEqual('Updated City');
      expect(result.phone).toEqual(testAddressInput.phone); // unchanged
      expect(result.is_default).toBe(true);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save updated address to database', async () => {
      const updateInput: UpdateAddressInput = {
        id: addressId,
        recipient_name: 'Database Update Test'
      };

      await updateAddress(updateInput);

      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.id, addressId))
        .execute();

      expect(addresses[0].recipient_name).toEqual('Database Update Test');
    });

    it('should handle setting as default and unset other defaults', async () => {
      // Create a second address that's default
      const secondAddress = await createAddress({
        ...testAddressInput,
        recipient_name: 'Second Address',
        is_default: true
      });

      // Update first address to be default
      await updateAddress({
        id: addressId,
        is_default: true
      });

      // Check that only the first address is now default
      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.user_id, userId))
        .execute();

      const firstAddressInDb = addresses.find(a => a.id === addressId);
      const secondAddressInDb = addresses.find(a => a.id === secondAddress.id);

      expect(firstAddressInDb?.is_default).toBe(true);
      expect(secondAddressInDb?.is_default).toBe(false);
    });

    it('should throw error for non-existent address', async () => {
      expect(updateAddress({
        id: 99999,
        recipient_name: 'Test'
      })).rejects.toThrow(/Address with id 99999 not found/i);
    });
  });

  describe('getUserAddresses', () => {
    it('should return empty array for user with no addresses', async () => {
      const input: GetUserAddressesInput = { user_id: userId };
      const result = await getUserAddresses(input);

      expect(result).toHaveLength(0);
    });

    it('should return user addresses ordered by default first', async () => {
      // Create multiple addresses
      await createAddress({
        ...testAddressInput,
        recipient_name: 'Address 1',
        is_default: false
      });
      
      await createAddress({
        ...testAddressInput,
        recipient_name: 'Address 2',
        is_default: true
      });

      await createAddress({
        ...testAddressInput,
        recipient_name: 'Address 3',
        is_default: false
      });

      const input: GetUserAddressesInput = { user_id: userId };
      const result = await getUserAddresses(input);

      expect(result).toHaveLength(3);
      // Default address should be first due to ordering
      expect(result[0].recipient_name).toEqual('Address 2');
      expect(result[0].is_default).toBe(true);
    });

    it('should only return addresses for specified user', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'seconduser',
          email: 'second@example.com'
        })
        .returning()
        .execute();

      // Create address for first user
      await createAddress(testAddressInput);

      // Create address for second user
      await createAddress({
        ...testAddressInput,
        user_id: secondUser[0].id,
        recipient_name: 'Second User Address'
      });

      const input: GetUserAddressesInput = { user_id: userId };
      const result = await getUserAddresses(input);

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toEqual(userId);
      expect(result[0].recipient_name).toEqual('John Doe');
    });

    it('should throw error for non-existent user', async () => {
      const input: GetUserAddressesInput = { user_id: 99999 };
      
      expect(getUserAddresses(input)).rejects.toThrow(/User with id 99999 not found/i);
    });
  });

  describe('deleteAddress', () => {
    let addressId: number;

    beforeEach(async () => {
      const address = await createAddress(testAddressInput);
      addressId = address.id;
    });

    it('should delete address successfully', async () => {
      const result = await deleteAddress(addressId);

      expect(result).toBe(true);

      // Verify address is deleted from database
      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.id, addressId))
        .execute();

      expect(addresses).toHaveLength(0);
    });

    it('should return false for non-existent address', async () => {
      const result = await deleteAddress(99999);

      expect(result).toBe(false);
    });
  });

  describe('setDefaultAddress', () => {
    let addressId1: number;
    let addressId2: number;

    beforeEach(async () => {
      const address1 = await createAddress({
        ...testAddressInput,
        recipient_name: 'Address 1',
        is_default: true
      });
      
      const address2 = await createAddress({
        ...testAddressInput,
        recipient_name: 'Address 2',
        is_default: false
      });

      addressId1 = address1.id;
      addressId2 = address2.id;
    });

    it('should set address as default and unset others', async () => {
      const result = await setDefaultAddress(userId, addressId2);

      expect(result.id).toEqual(addressId2);
      expect(result.is_default).toBe(true);

      // Verify in database that only the target address is default
      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.user_id, userId))
        .execute();

      const address1InDb = addresses.find(a => a.id === addressId1);
      const address2InDb = addresses.find(a => a.id === addressId2);

      expect(address1InDb?.is_default).toBe(false);
      expect(address2InDb?.is_default).toBe(true);
    });

    it('should throw error for non-existent address', async () => {
      expect(setDefaultAddress(userId, 99999)).rejects.toThrow(
        /Address with id 99999 not found for user/i
      );
    });

    it('should throw error when address belongs to different user', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          ...testUser,
          username: 'seconduser',
          email: 'second@example.com'
        })
        .returning()
        .execute();

      expect(setDefaultAddress(secondUser[0].id, addressId1)).rejects.toThrow(
        /Address with id .* not found for user/i
      );
    });
  });
});