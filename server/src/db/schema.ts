import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'distributor']);
export const productTypeEnum = pgEnum('product_type', ['physical', 'virtual']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  referrer_id: integer('referrer_id'), // First level referrer
  secondary_referrer_id: integer('secondary_referrer_id'), // Second level referrer
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  type: productTypeEnum('type').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  is_enabled: boolean('is_enabled').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  referral_fee_level_1: numeric('referral_fee_level_1', { precision: 10, scale: 2 }), // Nullable
  referral_fee_level_2: numeric('referral_fee_level_2', { precision: 10, scale: 2 }), // Nullable
  shipping_address: text('shipping_address'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Referral commissions table
export const referralCommissionsTable = pgTable('referral_commissions', {
  id: serial('id').primaryKey(),
  distributor_id: integer('distributor_id').notNull(),
  order_id: integer('order_id').notNull(),
  level: integer('level').notNull(), // 1 for first level, 2 for second level
  commission_percentage: numeric('commission_percentage', { precision: 5, scale: 2 }).notNull(),
  commission_amount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  referrer: one(usersTable, {
    fields: [usersTable.referrer_id],
    references: [usersTable.id],
    relationName: 'referrer'
  }),
  secondaryReferrer: one(usersTable, {
    fields: [usersTable.secondary_referrer_id],
    references: [usersTable.id],
    relationName: 'secondaryReferrer'
  }),
  orders: many(ordersTable),
  referralCommissions: many(referralCommissionsTable, {
    relationName: 'distributorCommissions'
  }),
  referredUsers: many(usersTable, {
    relationName: 'referrer'
  }),
  secondaryReferredUsers: many(usersTable, {
    relationName: 'secondaryReferrer'
  })
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
  orderItems: many(orderItemsTable)
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id]
  }),
  orderItems: many(orderItemsTable),
  referralCommissions: many(referralCommissionsTable)
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

export const referralCommissionsRelations = relations(referralCommissionsTable, ({ one }) => ({
  distributor: one(usersTable, {
    fields: [referralCommissionsTable.distributor_id],
    references: [usersTable.id],
    relationName: 'distributorCommissions'
  }),
  order: one(ordersTable, {
    fields: [referralCommissionsTable.order_id],
    references: [ordersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;
export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;
export type ReferralCommission = typeof referralCommissionsTable.$inferSelect;
export type NewReferralCommission = typeof referralCommissionsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  products: productsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  referralCommissions: referralCommissionsTable
};