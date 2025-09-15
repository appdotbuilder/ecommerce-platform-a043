import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  updateInventoryInputSchema,
  createOrderInputSchema,
  updateOrderInputSchema,
  getUserOrdersInputSchema,
  getReferralCommissionsInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createProduct } from './handlers/create_product';
import { getProducts } from './handlers/get_products';
import { updateProduct } from './handlers/update_product';
import { updateInventory } from './handlers/update_inventory';
import { createOrder } from './handlers/create_order';
import { getUserOrders } from './handlers/get_user_orders';
import { updateOrder } from './handlers/update_order';
import { getAllOrders } from './handlers/get_all_orders';
import { getReferralCommissions } from './handlers/get_referral_commissions';
import { getOrderItems } from './handlers/get_order_items';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  // Product management
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  getProducts: publicProcedure
    .query(() => getProducts()),

  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),

  updateInventory: publicProcedure
    .input(updateInventoryInputSchema)
    .mutation(({ input }) => updateInventory(input)),

  // Order management
  createOrder: publicProcedure
    .input(createOrderInputSchema)
    .mutation(({ input }) => createOrder(input)),

  getUserOrders: publicProcedure
    .input(getUserOrdersInputSchema)
    .query(({ input }) => getUserOrders(input)),

  updateOrder: publicProcedure
    .input(updateOrderInputSchema)
    .mutation(({ input }) => updateOrder(input)),

  getAllOrders: publicProcedure
    .query(() => getAllOrders()),

  getOrderItems: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(({ input }) => getOrderItems(input.orderId)),

  // Referral system
  getReferralCommissions: publicProcedure
    .input(getReferralCommissionsInputSchema)
    .query(({ input }) => getReferralCommissions(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();