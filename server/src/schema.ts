import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  password_hash: z.string(),
  role: z.enum(['consumer', 'admin']),
  avatar_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.number().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  price: z.number(),
  original_price: z.number().nullable(),
  category_id: z.number(),
  product_type: z.enum(['physical', 'virtual']),
  stock_quantity: z.number().int(),
  sku: z.string(),
  images: z.array(z.string()),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  weight: z.number().nullable(),
  dimensions: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Address schema
export const addressSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  recipient_name: z.string(),
  phone: z.string(),
  province: z.string(),
  city: z.string(),
  district: z.string(),
  street_address: z.string(),
  postal_code: z.string().nullable(),
  is_default: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Address = z.infer<typeof addressSchema>;

// Cart schema
export const cartItemSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  order_number: z.string(),
  total_amount: z.number(),
  shipping_fee: z.number(),
  discount_amount: z.number(),
  final_amount: z.number(),
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']),
  payment_method: z.string().nullable(),
  shipping_address: z.string(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
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

// Distributor schema
export const distributorSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  referral_code: z.string(),
  commission_rate: z.number(),
  total_earnings: z.number(),
  status: z.enum(['active', 'inactive', 'suspended']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Distributor = z.infer<typeof distributorSchema>;

// Commission schema
export const commissionSchema = z.object({
  id: z.number(),
  distributor_id: z.number(),
  order_id: z.number(),
  commission_amount: z.number(),
  commission_rate: z.number(),
  status: z.enum(['pending', 'paid', 'cancelled']),
  paid_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Commission = z.infer<typeof commissionSchema>;

// Input schemas for creating/updating entities

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  phone: z.string().nullable(),
  password: z.string().min(6),
  role: z.enum(['consumer', 'admin']).default('consumer'),
  avatar_url: z.string().nullable()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Category input schemas
export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  parent_id: z.number().nullable(),
  sort_order: z.number().int().default(0)
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  parent_id: z.number().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Product input schemas
export const createProductInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  price: z.number().positive(),
  original_price: z.number().positive().nullable(),
  category_id: z.number(),
  product_type: z.enum(['physical', 'virtual']),
  stock_quantity: z.number().int().nonnegative(),
  sku: z.string().min(1),
  images: z.array(z.string()).default([]),
  weight: z.number().positive().nullable(),
  dimensions: z.string().nullable()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  original_price: z.number().positive().nullable().optional(),
  category_id: z.number().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  weight: z.number().positive().nullable().optional(),
  dimensions: z.string().nullable().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Address input schemas
export const createAddressInputSchema = z.object({
  user_id: z.number(),
  recipient_name: z.string().min(1).max(100),
  phone: z.string().min(1),
  province: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  street_address: z.string().min(1),
  postal_code: z.string().nullable(),
  is_default: z.boolean().default(false)
});

export type CreateAddressInput = z.infer<typeof createAddressInputSchema>;

export const updateAddressInputSchema = z.object({
  id: z.number(),
  recipient_name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  street_address: z.string().min(1).optional(),
  postal_code: z.string().nullable().optional(),
  is_default: z.boolean().optional()
});

export type UpdateAddressInput = z.infer<typeof updateAddressInputSchema>;

// Cart input schemas
export const addToCartInputSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z.object({
  id: z.number(),
  quantity: z.number().int().positive()
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

// Order input schemas
export const createOrderInputSchema = z.object({
  user_id: z.number(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive(),
    unit_price: z.number().positive()
  })),
  shipping_address_id: z.number(),
  payment_method: z.string(),
  notes: z.string().nullable(),
  referral_code: z.string().nullable()
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  id: z.number(),
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Distributor input schemas
export const createDistributorInputSchema = z.object({
  user_id: z.number(),
  commission_rate: z.number().min(0).max(1)
});

export type CreateDistributorInput = z.infer<typeof createDistributorInputSchema>;

export const updateDistributorInputSchema = z.object({
  id: z.number(),
  commission_rate: z.number().min(0).max(1).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
});

export type UpdateDistributorInput = z.infer<typeof updateDistributorInputSchema>;

// Query input schemas
export const getUserByIdInputSchema = z.object({
  id: z.number()
});

export type GetUserByIdInput = z.infer<typeof getUserByIdInputSchema>;

export const getProductsInputSchema = z.object({
  category_id: z.number().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  product_type: z.enum(['physical', 'virtual']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export type GetProductsInput = z.infer<typeof getProductsInputSchema>;

export const getOrdersInputSchema = z.object({
  user_id: z.number().optional(),
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export type GetOrdersInput = z.infer<typeof getOrdersInputSchema>;

export const getUserCartInputSchema = z.object({
  user_id: z.number()
});

export type GetUserCartInput = z.infer<typeof getUserCartInputSchema>;

export const getUserAddressesInputSchema = z.object({
  user_id: z.number()
});

export type GetUserAddressesInput = z.infer<typeof getUserAddressesInputSchema>;

export const getDistributorCommissionsInputSchema = z.object({
  distributor_id: z.number(),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export type GetDistributorCommissionsInput = z.infer<typeof getDistributorCommissionsInputSchema>;