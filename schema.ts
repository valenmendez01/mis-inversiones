import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// --- TABLAS DEL TENANT (Estarán en la BD de cada cliente) ---

// Metadatos del activo (se cargan una sola vez)
export const assets = sqliteTable('assets', {
  ticker: text('ticker').primaryKey(),
  name: text('name').notNull(),
  sector: text('sector'),
  location: text('location'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Registro de cada compra/venta
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull().references(() => assets.ticker),
  type: text('type', { enum: ['COMPRA', 'VENTA'] }).notNull().default('COMPRA'),
  price: real('price').notNull(), // Precio por unidad
  quantity: real('quantity').notNull(),
  date: text('date').notNull(),
  commission: real('commission').notNull(), // precio * cantidad * 0.008
});

// --- TABLA MASTER (Estará solo en la BD principal) ---

// login
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(), // Hash de la contraseña
  dbUrl: text('db_url'),     // URL de la base de datos Turso del cliente
  dbToken: text('db_token'), // Token de acceso de esa base
});

// Tipos para Assets
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// Tipos para Transactions (Movimientos)
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;