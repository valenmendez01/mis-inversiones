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

// Creamos un acceso "limpio" para el editor
const yf = new YahooFinance();

// --- Obtener Dólar CCL ---
async function getDolarCCL() {
  try {
    // Usamos la API de DolarApi. Revalidamos cada 1 hora (3600 seg) para no saturar la API
    const res = await fetch("https://dolarapi.com/v1/dolares/contadoconliqui", { 
      next: { revalidate: 3600 } 
    });
    const data = await res.json();
    // Retornamos el precio de venta. Si falla por algún motivo, devolvemos 1 para no romper cálculos
    return data.venta || 1; 
  } catch (error) {
    console.error("Error obteniendo Dólar CCL:", error);
    return 1; 
  }
}

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
    // Obtenemos cotizaciones en ARS y el CCL actual en simultáneo
    const [quotes, dolarCCL] = await Promise.all([
      yf.quote(symbols),
      getDolarCCL()
    ]);

    return uniqueTickers.map(ticker => {
      const asset = allAssets.find(a => a.ticker === ticker);
      const assetTx = allTx
        .filter(t => t.ticker === ticker)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const quote = quotes.find(q => q.symbol.startsWith(ticker));
      
      // CONVERSIÓN MAGISTRAL: Pasamos el precio de Yahoo (ARS) a USD CCL
      const currentPriceARS = quote?.regularMarketPrice || 0;
      const currentPriceUSD = dolarCCL > 1 ? currentPriceARS / dolarCCL : currentPriceARS;

      let currentQuantity = 0;
      let totalInvestedBasis = 0; 
      let realizedGain = 0; 

      for (const tx of assetTx) {
        // tx.price y tx.commission ya están en USD en la base de datos
        if (tx.type === 'COMPRA') {
          const cost = (tx.price * tx.quantity) + tx.commission;
          totalInvestedBasis += cost;
          currentQuantity += tx.quantity;
        } 
        else if (tx.type === 'VENTA') {
          const ppcActual = currentQuantity > 0 ? totalInvestedBasis / currentQuantity : 0;
          const costoDeLasAccionesVendidas = ppcActual * tx.quantity;
          const ingresoNeto = (tx.price * tx.quantity) - tx.commission;

          realizedGain += (ingresoNeto - costoDeLasAccionesVendidas);
          currentQuantity -= tx.quantity;
          totalInvestedBasis -= costoDeLasAccionesVendidas; 
        }
      }

      if (currentQuantity <= 0) {
        currentQuantity = 0;
        totalInvestedBasis = 0;
      }

      // Todos los cálculos ahora son USD contra USD
      const currentValue = currentQuantity * currentPriceUSD;
      const ppc = currentQuantity > 0 ? totalInvestedBasis / currentQuantity : 0;

      return {
        ticker,
        name: asset?.name,
        sector: asset?.sector,
        quantity: currentQuantity,
        ppc: ppc,
        investment: totalInvestedBasis,
        cedearValue: currentPriceUSD, // Ahora devuelve el valor en Dólares
        currentValue: currentValue,
        diffCash: currentValue - totalInvestedBasis, 
        diffPercent: totalInvestedBasis > 0 ? ((currentValue / totalInvestedBasis) - 1) * 100 : 0,
        realizedGain: realizedGain
      };
    });
  } catch (error) {
    console.error("Error en getPortfolioData:", error);
    return [];
  }
}

// Obtener el historial de movimientos
export async function getTransactionsData() {
  return await db.select().from(transactions).orderBy(desc(transactions.id));
}

// Eliminar un movimiento específico
export async function deleteTransactionData(id: number) {
  try {
    // 1. Obtener la transacción que se intenta eliminar para saber el ticker y tipo
    const txToDelete = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    
    if (!txToDelete) {
      return { success: false, error: "Transacción no encontrada." };
    }

    // 2. Si es una COMPRA, validamos que su eliminación no rompa el historial futuro
    if (txToDelete.type === 'COMPRA') {
      // Traemos todo el historial del activo, ordenado cronológicamente
      const allAssetTx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.ticker, txToDelete.ticker))
        .orderBy(transactions.date, transactions.id); // Ordenamos por fecha
        
      let simulatedQuantity = 0;
      
      for (const tx of allAssetTx) {
        // Ignoramos la transacción que queremos eliminar en esta simulación
        if (tx.id === id) continue;

        if (tx.type === 'COMPRA') simulatedQuantity += tx.quantity;
        if (tx.type === 'VENTA') simulatedQuantity -= tx.quantity;

        // Si en CUALQUIER punto de la historia el balance da negativo, bloqueamos
        if (simulatedQuantity < 0) {
          return { 
            success: false, 
            error: `No puedes eliminar esta compra. Dejaría tu tenencia de ${txToDelete.ticker} en negativo debido a ventas posteriores.` 
          };
        }
      }
    }

    // 3. Si es una VENTA (eliminarla suma activos) o la simulación de COMPRA fue exitosa, borramos
    await db.delete(transactions).where(eq(transactions.id, id));
    return { success: true };
    
  } catch (error) {
    console.error("Error en deleteTransactionData:", error);
    return { success: false, error: "Error inesperado al eliminar el movimiento." };
  }
}

// Actualizar un movimiento (Opcional, si decides editar filas del historial)
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
    // Obtenemos cotizaciones y el CCL
    const [quotes, dolarCCL] = await Promise.all([
      yf.quote(symbols),
      getDolarCCL()
    ]);

    let cumulativeInvestment = 0;
    const currentQuantities: Record<string, number> = {};

    return allTx.map(tx => {
      // 1. Inversión acumulada en USD
      const cost = (tx.price * tx.quantity) + tx.commission;
      cumulativeInvestment += cost;

      currentQuantities[tx.ticker] = (currentQuantities[tx.ticker] || 0) + tx.quantity;

      // 3. Calcular el valor de mercado convertido a USD
      let currentMarketValue = 0;
      for (const [ticker, qty] of Object.entries(currentQuantities)) {
        const quote = quotes.find(q => q.symbol.startsWith(ticker));
        const priceARS = quote?.regularMarketPrice || 0;
        const priceUSD = dolarCCL > 1 ? priceARS / dolarCCL : priceARS;
        
        currentMarketValue += qty * priceUSD;
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