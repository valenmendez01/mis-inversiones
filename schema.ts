import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const cedears = sqliteTable('cedears', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(), // Ej: 'AAPL', 'MSFT', 'SPY'
  pesosSpent: real('pesos_spent').notNull(), // Pesos gastados en la compra
  cclPurchase: real('ccl_purchase').notNull(), // Precio del dólar CCL al comprar
  pesosCurrent: real('pesos_current').notNull(), // Valor actual en pesos
  cclCurrent: real('ccl_current').notNull(), // Precio actual del dólar CCL
  purchaseDate: text('purchase_date').notNull(), // Fecha de compra (ISO string)
});

export type Cedear = typeof cedears.$inferSelect;
export type InsertCedear = typeof cedears.$inferInsert;