import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createUserInputSchema,
  updateUserInputSchema,
  getUserByIdInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  getProductsInputSchema,
  createAddressInputSchema,
  updateAddressInputSchema,
  getUserAddressesInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  getUserCartInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  getOrdersInputSchema,
  createDistributorInputSchema,
  updateDistributorInputSchema,
  getDistributorCommissionsInputSchema
} from './schema';

// Import all handlers
import { createUser, updateUser, getUserById, getAllUsers } from './handlers/user_handlers';
import { createCategory, updateCategory, getCategories, getCategoryById, deleteCategory } from './handlers/category_handlers';
import { createProduct, updateProduct, getProducts, getProductById, toggleProductStatus, updateProductStock } from './handlers/product_handlers';
import { createAddress, updateAddress, getUserAddresses, deleteAddress, setDefaultAddress } from './handlers/address_handlers';
import { addToCart, updateCartItem, getUserCart, removeFromCart, clearCart, getCartItemsCount } from './handlers/cart_handlers';
import { createOrder, updateOrderStatus, getOrders, getOrderById, getOrderItems, cancelOrder, processPayment } from './handlers/order_handlers';
import { createDistributor, updateDistributor, getDistributorByUserId, getDistributorByReferralCode, getDistributorCommissions, createCommission, payCommission, getAllDistributors } from './handlers/distributor_handlers';

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

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),
  
  getUserById: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getUserById(input)),
  
  getAllUsers: publicProcedure
    .query(() => getAllUsers()),

  // Category management routes
  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),
  
  updateCategory: publicProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input }) => updateCategory(input)),
  
  getCategories: publicProcedure
    .query(() => getCategories()),
  
  getCategoryById: publicProcedure
    .input(getUserByIdInputSchema) // reusing the same schema for ID input
    .query(({ input }) => getCategoryById(input.id)),
  
  deleteCategory: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => deleteCategory(input.id)),

  // Product management routes
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),
  
  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),
  
  getProducts: publicProcedure
    .input(getProductsInputSchema)
    .query(({ input }) => getProducts(input)),
  
  getProductById: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getProductById(input.id)),
  
  toggleProductStatus: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => toggleProductStatus(input.id)),
  
  updateProductStock: publicProcedure
    .input(z.object({ productId: z.number(), quantity: z.number().int().nonnegative() }))
    .mutation(({ input }) => updateProductStock(input.productId, input.quantity)),

  // Address management routes
  createAddress: publicProcedure
    .input(createAddressInputSchema)
    .mutation(({ input }) => createAddress(input)),
  
  updateAddress: publicProcedure
    .input(updateAddressInputSchema)
    .mutation(({ input }) => updateAddress(input)),
  
  getUserAddresses: publicProcedure
    .input(getUserAddressesInputSchema)
    .query(({ input }) => getUserAddresses(input)),
  
  deleteAddress: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => deleteAddress(input.id)),
  
  setDefaultAddress: publicProcedure
    .input(z.object({ userId: z.number(), addressId: z.number() }))
    .mutation(({ input }) => setDefaultAddress(input.userId, input.addressId)),

  // Cart management routes
  addToCart: publicProcedure
    .input(addToCartInputSchema)
    .mutation(({ input }) => addToCart(input)),
  
  updateCartItem: publicProcedure
    .input(updateCartItemInputSchema)
    .mutation(({ input }) => updateCartItem(input)),
  
  getUserCart: publicProcedure
    .input(getUserCartInputSchema)
    .query(({ input }) => getUserCart(input)),
  
  removeFromCart: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => removeFromCart(input.id)),
  
  clearCart: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => clearCart(input.id)),
  
  getCartItemsCount: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getCartItemsCount(input.id)),

  // Order management routes
  createOrder: publicProcedure
    .input(createOrderInputSchema)
    .mutation(({ input }) => createOrder(input)),
  
  updateOrderStatus: publicProcedure
    .input(updateOrderStatusInputSchema)
    .mutation(({ input }) => updateOrderStatus(input)),
  
  getOrders: publicProcedure
    .input(getOrdersInputSchema)
    .query(({ input }) => getOrders(input)),
  
  getOrderById: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getOrderById(input.id)),
  
  getOrderItems: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getOrderItems(input.id)),
  
  cancelOrder: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => cancelOrder(input.id)),
  
  processPayment: publicProcedure
    .input(z.object({ orderId: z.number(), paymentData: z.any() }))
    .mutation(({ input }) => processPayment(input.orderId, input.paymentData)),

  // Distributor management routes
  createDistributor: publicProcedure
    .input(createDistributorInputSchema)
    .mutation(({ input }) => createDistributor(input)),
  
  updateDistributor: publicProcedure
    .input(updateDistributorInputSchema)
    .mutation(({ input }) => updateDistributor(input)),
  
  getDistributorByUserId: publicProcedure
    .input(getUserByIdInputSchema)
    .query(({ input }) => getDistributorByUserId(input.id)),
  
  getDistributorByReferralCode: publicProcedure
    .input(z.object({ referralCode: z.string() }))
    .query(({ input }) => getDistributorByReferralCode(input.referralCode)),
  
  getDistributorCommissions: publicProcedure
    .input(getDistributorCommissionsInputSchema)
    .query(({ input }) => getDistributorCommissions(input)),
  
  createCommission: publicProcedure
    .input(z.object({ distributorId: z.number(), orderId: z.number(), commissionAmount: z.number(), commissionRate: z.number() }))
    .mutation(({ input }) => createCommission(input.distributorId, input.orderId, input.commissionAmount, input.commissionRate)),
  
  payCommission: publicProcedure
    .input(getUserByIdInputSchema)
    .mutation(({ input }) => payCommission(input.id)),
  
  getAllDistributors: publicProcedure
    .query(() => getAllDistributors())
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