import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['consumer', 'admin']);
export const productTypeEnum = pgEnum('product_type', ['physical', 'virtual']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded']);
export const distributorStatusEnum = pgEnum('distributor_status', ['active', 'inactive', 'suspended']);
export const commissionStatusEnum = pgEnum('commission_status', ['pending', 'paid', 'cancelled']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('consumer'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  parent_id: integer('parent_id'),
  sort_order: integer('sort_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  short_description: text('short_description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  original_price: numeric('original_price', { precision: 10, scale: 2 }),
  category_id: integer('category_id').notNull(),
  product_type: productTypeEnum('product_type').notNull(),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  sku: text('sku').notNull().unique(),
  images: json('images').$type<string[]>().notNull().default([]),
  is_active: boolean('is_active').notNull().default(true),
  is_featured: boolean('is_featured').notNull().default(false),
  weight: numeric('weight', { precision: 8, scale: 3 }),
  dimensions: text('dimensions'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Addresses table
export const addressesTable = pgTable('addresses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  recipient_name: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  province: text('province').notNull(),
  city: text('city').notNull(),
  district: text('district').notNull(),
  street_address: text('street_address').notNull(),
  postal_code: text('postal_code'),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  order_number: text('order_number').notNull().unique(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  shipping_fee: numeric('shipping_fee', { precision: 10, scale: 2 }).notNull().default('0'),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  final_amount: numeric('final_amount', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  payment_status: paymentStatusEnum('payment_status').notNull().default('pending'),
  payment_method: text('payment_method'),
  shipping_address: text('shipping_address').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Distributors table
export const distributorsTable = pgTable('distributors', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().unique(),
  referral_code: text('referral_code').notNull().unique(),
  commission_rate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
  total_earnings: numeric('total_earnings', { precision: 10, scale: 2 }).notNull().default('0'),
  status: distributorStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Commissions table
export const commissionsTable = pgTable('commissions', {
  id: serial('id').primaryKey(),
  distributor_id: integer('distributor_id').notNull(),
  order_id: integer('order_id').notNull(),
  commission_amount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  commission_rate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
  status: commissionStatusEnum('status').notNull().default('pending'),
  paid_at: timestamp('paid_at'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  addresses: many(addressesTable),
  cartItems: many(cartItemsTable),
  orders: many(ordersTable),
  distributor: many(distributorsTable)
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  parent: one(categoriesTable, {
    fields: [categoriesTable.parent_id],
    references: [categoriesTable.id]
  }),
  children: many(categoriesTable),
  products: many(productsTable)
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.category_id],
    references: [categoriesTable.id]
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable)
}));

export const addressesRelations = relations(addressesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [addressesTable.user_id],
    references: [usersTable.id]
  })
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [cartItemsTable.user_id],
    references: [usersTable.id]
  }),
  product: one(productsTable, {
    fields: [cartItemsTable.product_id],
    references: [productsTable.id]
  })
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id]
  }),
  items: many(orderItemsTable),
  commissions: many(commissionsTable)
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id]
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id]
  })
}));

export const distributorsRelations = relations(distributorsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [distributorsTable.user_id],
    references: [usersTable.id]
  }),
  commissions: many(commissionsTable)
}));

export const commissionsRelations = relations(commissionsTable, ({ one }) => ({
  distributor: one(distributorsTable, {
    fields: [commissionsTable.distributor_id],
    references: [distributorsTable.id]
  }),
  order: one(ordersTable, {
    fields: [commissionsTable.order_id],
    references: [ordersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

export type Address = typeof addressesTable.$inferSelect;
export type NewAddress = typeof addressesTable.$inferInsert;

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;

export type Distributor = typeof distributorsTable.$inferSelect;
export type NewDistributor = typeof distributorsTable.$inferInsert;

export type Commission = typeof commissionsTable.$inferSelect;
export type NewCommission = typeof commissionsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  products: productsTable,
  addresses: addressesTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  distributors: distributorsTable,
  commissions: commissionsTable
};