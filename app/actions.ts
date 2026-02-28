// app/actions.ts
"use server";

import YahooFinance from 'yahoo-finance2';
import { db } from "./db";
import { assets, transactions, type InsertTransaction } from "../schema";
import { desc, eq } from "drizzle-orm";

// 1. Interfaces para mantener el tipado después de limpiar el acceso
interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
}

interface YahooFinanceMetadata {
  quoteType?: { longName?: string };
  assetProfile?: { sector?: string; country?: string };
}

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
}

// Creamos un acceso "limpio" para el editor
const yf = new YahooFinance();

export async function searchTickers(query: string) {
  if (query.length < 2) return [];
  try {
    const result = await yf.search(query, { quotesCount: 6, newsCount: 0 });
    const quotes = (result.quotes || []) as YahooSearchQuote[];
    
    return quotes
      .filter(q => q.symbol)
      .map(q => ({
        label: `${q.symbol} - ${q.shortname || ''}`,
        key: q.symbol,
      }));
  } catch (error) {
    console.error("Error en búsqueda:", error);
    return [];
  }
}

export async function addTransaction(data: InsertTransaction) {
  try {
    const existing = await db.select().from(assets).where(eq(assets.ticker, data.ticker)).get();
    
    if (!existing) {
      const meta = await yf.quoteSummary(data.ticker, { modules: ["assetProfile", "quoteType"] });

      await db.insert(assets).values({
        ticker: data.ticker,
        name: meta.quoteType?.longName || data.ticker,
        sector: meta.assetProfile?.sector || "Otros",
        location: meta.assetProfile?.country || "N/A",
        updatedAt: new Date(),
      });
    }

    await db.insert(transactions).values(data);
    return { success: true };
  } catch (error) {
    console.error("Error en addTransaction:", error);
    return { success: false };
  }
}

export async function getPortfolioData() {
  const allTx = await db.select().from(transactions);
  const allAssets = await db.select().from(assets);
  
  const uniqueTickers = Array.from(new Set(allTx.map(t => t.ticker)));
  if (uniqueTickers.length === 0) return [];

  const symbols = uniqueTickers.map(t => t.includes('.') ? t : `${t}.BA`);
  
  try {
    const quotes = await yf.quote(symbols);

    return uniqueTickers.map(ticker => {
      const asset = allAssets.find(a => a.ticker === ticker);
      const assetTx = allTx.filter(t => t.ticker === ticker);
      const quote = quotes.find(q => q.symbol.startsWith(ticker));

      const totalQuantity = assetTx.reduce((acc, t) => acc + t.quantity, 0);
      const totalInvestment = assetTx.reduce((acc, t) => acc + (t.price * t.quantity) + t.commission, 0);
      const currentPrice = quote?.regularMarketPrice || 0;
      const currentValue = totalQuantity * currentPrice;

      return {
        location: asset?.location,
        sector: asset?.sector,
        ticker,
        name: asset?.name,
        quantity: totalQuantity,
        investment: totalInvestment,
        cedearValue: currentPrice,
        currentValue,
        ppc: totalQuantity > 0 ? totalInvestment / totalQuantity : 0,
        diffCash: currentValue - totalInvestment,
        diffPercent: totalInvestment > 0 ? (currentValue / totalInvestment - 1) * 100 : 0,
      };
    });
  } catch (error) {
    console.error("Error en getPortfolioData:", error);
    return [];
  }
}

// 1. Obtener el historial de movimientos (Tabla superior)
export async function getTransactionsData() {
  return await db.select().from(transactions).orderBy(desc(transactions.id));
}

// 2. Agregar un movimiento (Ya lo tienes como addTransaction, 
// pero asegúrate de que use InsertTransaction de schema.ts)
export async function addTransactionData(data: typeof transactions.$inferInsert) {
  await db.insert(transactions).values(data);
  return { success: true };
}

// 3. Eliminar un movimiento específico
export async function deleteTransactionData(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));
  return { success: true };
}

// 4. Actualizar un movimiento (Opcional, si decides editar filas del historial)
export async function updateTransactionData(id: number, data: Partial<typeof transactions.$inferInsert>) {
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  return { success: true };
}