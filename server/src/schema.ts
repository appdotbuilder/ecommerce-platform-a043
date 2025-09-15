import { z } from 'zod';

// Enums
export const userRoleSchema = z.enum(['user', 'admin', 'distributor']);
export const productTypeSchema = z.enum(['physical', 'virtual']);
export const orderStatusSchema = z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  referrer_id: z.number().nullable(), // First level referrer
  secondary_referrer_id: z.number().nullable(), // Second level referrer
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: productTypeSchema,
  price: z.number(),
  stock_quantity: z.number().int(),
  is_enabled: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  status: orderStatusSchema,
  total_amount: z.number(),
  referral_fee_level_1: z.number().nullable(),
  referral_fee_level_2: z.number().nullable(),
  shipping_address: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order Item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Referral Commission schema
export const referralCommissionSchema = z.object({
  id: z.number(),
  distributor_id: z.number(),
  order_id: z.number(),
  level: z.number().int().min(1).max(2), // 1 for first level, 2 for second level
  commission_percentage: z.number(),
  commission_amount: z.number(),
  created_at: z.coerce.date()
});

export type ReferralCommission = z.infer<typeof referralCommissionSchema>;

// Input schemas for creating users
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema.default('user'),
  referrer_id: z.number().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schemas for creating products
export const createProductInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  type: productTypeSchema,
  price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

// Input schemas for updating products
export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  is_enabled: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Input schemas for creating orders
export const createOrderInputSchema = z.object({
  user_id: z.number(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive()
  })),
  shipping_address: z.string().nullable().optional()
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Input schemas for updating orders
export const updateOrderInputSchema = z.object({
  id: z.number(),
  status: orderStatusSchema.optional(),
  shipping_address: z.string().nullable().optional()
});

export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;

// Input schema for updating inventory
export const updateInventoryInputSchema = z.object({
  product_id: z.number(),
  quantity_change: z.number().int() // Can be positive or negative
});

export type UpdateInventoryInput = z.infer<typeof updateInventoryInputSchema>;

// Query schemas
export const getUserOrdersInputSchema = z.object({
  user_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetUserOrdersInput = z.infer<typeof getUserOrdersInputSchema>;

export const getReferralCommissionsInputSchema = z.object({
  distributor_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetReferralCommissionsInput = z.infer<typeof getReferralCommissionsInputSchema>;