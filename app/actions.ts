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
    const cleanTicker = data.ticker.split(" - ")[0].trim().toUpperCase();

    const existing = await db.select().from(assets).where(eq(assets.ticker, cleanTicker)).get();
    
    if (!existing) {
      const meta = await yf.quoteSummary(cleanTicker, { modules: ["assetProfile", "quoteType"] });

      await db.insert(assets).values({
        ticker: cleanTicker,
        name: meta.quoteType?.longName || cleanTicker,
        sector: meta.assetProfile?.sector || "Otros",
        location: meta.assetProfile?.country || "N/A",
        updatedAt: new Date(),
      });
    }

    await db.insert(transactions).values({
      ...data,
      ticker: cleanTicker
    });
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
  try {
    const updateData = { ...data };

    // Si el ticker viene en el objeto de actualización, lo limpiamos
    if (updateData.ticker) {
      updateData.ticker = updateData.ticker.split(" - ")[0].trim().toUpperCase();
      
      // Opcional: Verificar si el activo existe en la tabla 'assets'
      const existing = await db.select().from(assets).where(eq(assets.ticker, updateData.ticker)).get();
      
      if (!existing) {
        // Si el activo es nuevo debido al cambio de ticker, 
        // podrías llamar a yf.quoteSummary aquí para crearlo en 'assets',
        // de lo contrario la actualización fallará nuevamente.
        const meta = await yf.quoteSummary(updateData.ticker, { modules: ["assetProfile", "quoteType"] });
        
        await db.insert(assets).values({
          ticker: updateData.ticker,
          name: meta.quoteType?.longName || updateData.ticker,
          sector: meta.assetProfile?.sector || "Otros",
          location: meta.assetProfile?.country || "N/A",
          updatedAt: new Date(),
        });
      }
    }

    await db.update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error en updateTransactionData:", error);
    return { success: false };
  }
}

export async function getEvolutionData() {
  const allTx = await db.select().from(transactions).orderBy(transactions.date);
  if (allTx.length === 0) return [];

  const uniqueTickers = Array.from(new Set(allTx.map(t => t.ticker)));
  const symbols = uniqueTickers.map(t => t.includes('.') ? t : `${t}.BA`);
  
  try {
    const quotes = await yf.quote(symbols);
    let cumulativeInvestment = 0;
    const currentQuantities: Record<string, number> = {};

    return allTx.map(tx => {
      // 1. Acumular inversión (Costo + Comisión)
      const cost = (tx.price * tx.quantity) + tx.commission;
      cumulativeInvestment += cost;

      // 2. Actualizar cantidades acumuladas por ticker
      currentQuantities[tx.ticker] = (currentQuantities[tx.ticker] || 0) + tx.quantity;

      // 3. Calcular el valor de mercado de la cartera en ese punto temporal 
      // usando los precios actuales (proyección de crecimiento)
      let currentMarketValue = 0;
      for (const [ticker, qty] of Object.entries(currentQuantities)) {
        const quote = quotes.find(q => q.symbol.startsWith(ticker));
        currentMarketValue += qty * (quote?.regularMarketPrice || 0);
      }

      return {
        date: new Date(tx.date + 'T00:00:00'),
        invested: Number(cumulativeInvestment.toFixed(2)),
        value: Number(currentMarketValue.toFixed(2)),
      };
    });
  } catch (error) {
    console.error("Error en getEvolutionData:", error);
    return [];
  }
}