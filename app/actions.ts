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
    // --- VALIDACIÓN PARA VENTAS ---
    if (data.type === 'VENTA') {
      // Traemos todos los movimientos de ese ticker
      const allAssetTx = await db.select().from(transactions).where(eq(transactions.ticker, data.ticker));
      
      let currentQuantity = 0;
      for (const tx of allAssetTx) {
        if (tx.type === 'COMPRA') currentQuantity += tx.quantity;
        if (tx.type === 'VENTA') currentQuantity -= tx.quantity;
      }

      // Validamos que tenga el activo
      if (currentQuantity === 0) {
        return { success: false, error: "No tienes tenencia de este activo para vender." };
      }
      
      // Validamos que no intente vender más de lo que tiene
      if (data.quantity > currentQuantity) {
        return { 
          success: false, 
          error: `No puedes vender más de lo que tienes. Disponibles: ${currentQuantity}` 
        };
      }
    }

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
      // 1. Ordenar cronológicamente (del más antiguo al más nuevo)
      const assetTx = allTx
        .filter(t => t.ticker === ticker)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const quote = quotes.find(q => q.symbol.startsWith(ticker));
      const currentPrice = quote?.regularMarketPrice || 0;

      let currentQuantity = 0;
      let totalInvestedBasis = 0; // Costo de la tenencia actual
      let realizedGain = 0; // Ganancia/pérdida ya cobrada por ventas

      // 2. Calcular el histórico paso a paso
      for (const tx of assetTx) {
        if (tx.type === 'COMPRA') {
          const cost = (tx.price * tx.quantity) + tx.commission;
          totalInvestedBasis += cost;
          currentQuantity += tx.quantity;
        } 
        else if (tx.type === 'VENTA') {
          const ppcActual = currentQuantity > 0 ? totalInvestedBasis / currentQuantity : 0;
          
          // Cuánta plata nos costaron originalmente estas acciones que estamos vendiendo
          const costoDeLasAccionesVendidas = ppcActual * tx.quantity;
          
          // Cuánta plata nos entró en la mano
          const ingresoNeto = (tx.price * tx.quantity) - tx.commission;

          // Calculamos la ganancia/pérdida real de esta venta
          realizedGain += (ingresoNeto - costoDeLasAccionesVendidas);
          
          // Descontamos las acciones y su costo base de nuestro portfolio actual
          currentQuantity -= tx.quantity;
          totalInvestedBasis -= costoDeLasAccionesVendidas; 
        }
      }

      // Si por error de carga vendimos más de lo que teníamos, evitamos números negativos raros
      if (currentQuantity <= 0) {
        currentQuantity = 0;
        totalInvestedBasis = 0;
      }

      const currentValue = currentQuantity * currentPrice;
      const ppc = currentQuantity > 0 ? totalInvestedBasis / currentQuantity : 0;

      return {
        ticker,
        name: asset?.name,
        sector: asset?.sector,
        quantity: currentQuantity,
        ppc: ppc,
        investment: totalInvestedBasis, // Inversión activa (Latente)
        cedearValue: currentPrice,
        currentValue: currentValue,
        diffCash: currentValue - totalInvestedBasis, // Resultado Latente $
        diffPercent: totalInvestedBasis > 0 ? ((currentValue / totalInvestedBasis) - 1) * 100 : 0,
        realizedGain: realizedGain // <--- Nuevo dato: Plata que ya ganaste/perdiste y está en tu bolsillo
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

// 3. Eliminar un movimiento específico
export async function deleteTransactionData(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));
  return { success: true };
}

// 4. Actualizar un movimiento (Opcional, si decides editar filas del historial)
export async function updateTransactionData(id: number, data: Partial<typeof transactions.$inferInsert>) {
  try {
    const updateData = { ...data };

    // Si están actualizando algo que afecta la cantidad, el tipo o el ticker...
    if (updateData.type === 'VENTA' || (updateData.ticker && updateData.quantity)) {
      const targetTicker = updateData.ticker ? updateData.ticker.split(" - ")[0].trim().toUpperCase() : undefined;
      
      // Si el tipo es VENTA, tenemos que hacer la validación
      if (updateData.type === 'VENTA' && targetTicker && updateData.quantity) {
        
        // Traemos todos los movimientos de ese ticker
        const allAssetTx = await db.select().from(transactions).where(eq(transactions.ticker, targetTicker));
        
        let currentQuantity = 0;
        for (const tx of allAssetTx) {
          // MUY IMPORTANTE: Ignoramos la transacción actual que estamos editando
          // para no contarla dos veces en el cálculo de tenencia
          if (tx.id === id) continue; 

          if (tx.type === 'COMPRA') currentQuantity += tx.quantity;
          if (tx.type === 'VENTA') currentQuantity -= tx.quantity;
        }

        // Validamos que tenga el activo
        if (currentQuantity === 0) {
          return { success: false, error: "No tienes tenencia de este activo para vender." };
        }
        
        // Validamos que no intente vender más de lo que tiene (ignorando el movimiento actual)
        if (updateData.quantity > currentQuantity) {
          return { 
            success: false, 
            error: `No puedes vender más de lo que tienes. Disponibles: ${currentQuantity}` 
          };
        }
      }
    }

    // Si el ticker viene en el objeto de actualización, lo limpiamos
    if (updateData.ticker) {
      updateData.ticker = updateData.ticker.split(" - ")[0].trim().toUpperCase();
      
      // Opcional: Verificar si el activo existe en la tabla 'assets'
      const existing = await db.select().from(assets).where(eq(assets.ticker, updateData.ticker)).get();
      
      if (!existing) {
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
    // Cambiamos a devolver error de forma estructurada para que TypeScript no se queje
    return { success: false, error: "Error inesperado al actualizar la transacción." };
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