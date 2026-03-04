// app/actions.ts
"use server";

import YahooFinance from 'yahoo-finance2';
import { masterDb, connectTenant } from "./db";
import { assets, transactions, type InsertTransaction } from "../schema-tenant";
import { users } from "../schema-master";
import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { decrypt } from "./lib/session";

// 1. Interfaces para mantener el tipado después de limpiar el acceso
interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
}

// Creamos un acceso "limpio" para el editor
const yf = new YahooFinance();

// --- HELPER MAESTRO: Obtener conexión a la BD del cliente ---
async function getTenantDb() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) throw new Error("No autorizado");
  
  const payload = await decrypt(session);
  const userId = payload.userId as string;

  // 1. Buscamos las credenciales en la Master DB
  const user = await masterDb.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user || !user.dbUrl || !user.dbToken) {
    throw new Error("No tienes una base de datos asignada.");
  }

  // 2. Devolvemos la instancia de Drizzle conectada a SU base de datos
  return connectTenant(user.dbUrl, user.dbToken);
}

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
  
  let result;
  
  try {
    result = await yf.search(query, { quotesCount: 6, newsCount: 0 });
  } catch (error: any) {
    // Si el error es de validación de esquema, usamos los datos devueltos de todos modos
    if (error.name === 'FailedYahooValidationError' && error.result) {
      result = error.result;
    } else {
      console.error("Error en búsqueda:", error);
      return [];
    }
  }

  const quotes = (result.quotes || []) as YahooSearchQuote[];
  
  return quotes
    .filter(q => q.symbol)
    .map(q => ({
      label: `${q.symbol} - ${q.shortname || ''}`,
      key: q.symbol,
    }));
}

export async function addTransaction(data: InsertTransaction) {
  try {
    // Obtenemos la BD privada
    const tenantDb = await getTenantDb();

    // 1. Limpiamos el ticker ANTES de hacer la validación
    const cleanTicker = data.ticker.split(" - ")[0].trim().toUpperCase();

    // --- VALIDACIÓN PARA VENTAS ---
    if (data.type === 'VENTA') {
      // 2. Usamos "cleanTicker" en lugar de "data.ticker" para buscar en la base de datos
      const allAssetTx = await tenantDb.select().from(transactions).where(eq(transactions.ticker, cleanTicker));
      
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

    const existing = await tenantDb.select().from(assets).where(eq(assets.ticker, cleanTicker)).get();
    
    // Si NO existe, O si existe pero su sector quedó guardado como "Otros" o nulo
    if (!existing || existing.sector === "Otros" || !existing.sector) {
      try {
        const meta = await yf.quoteSummary(cleanTicker, { modules: ["assetProfile", "quoteType", "fundProfile"] });

        const isETF = meta.quoteType?.quoteType === 'ETF';
        const assetSector = meta.assetProfile?.sector || meta.fundProfile?.categoryName || (isETF ? "ETF" : "Otros");

        if (!existing) {
          // Si no existía en absoluto, lo insertamos
          await tenantDb.insert(assets).values({
            ticker: cleanTicker,
            name: meta.quoteType?.longName || cleanTicker,
            sector: assetSector,
            location: meta.assetProfile?.country || "N/A",
            updatedAt: new Date(),
          });
        } else {
          // Si existía pero tenía sector "Otros", lo actualizamos (AUTO-REPARACIÓN)
          await tenantDb.update(assets)
            .set({ sector: assetSector, updatedAt: new Date() })
            .where(eq(assets.ticker, cleanTicker));
        }
      } catch (err) {
        console.error(`Error obteniendo meta para ${cleanTicker}:`, err);
      }
    }

    await tenantDb.insert(transactions).values({
      ...data,
      ticker: cleanTicker
    });
    return { success: true };
  } catch (error) {
    console.error("Error en addTransaction:", error);
    return { success: false, error: "Ocurrió un error inesperado al procesar la transacción." };
  }
}

export async function getPortfolioData() {
  const tenantDb = await getTenantDb();

  const allTx = await tenantDb.select().from(transactions);
  const allAssets = await tenantDb.select().from(assets);
  
  const uniqueTickers = Array.from(new Set(allTx.map(t => t.ticker)));
  if (uniqueTickers.length === 0) return [];

  // Función para limpiar guiones en CEDEARs (ej: BRK-B -> BRKB.BA)
  const getYahooSymbol = (t: string) => t.includes('.') ? t : `${t.replace(/-/g, '')}.BA`;
  const symbols = uniqueTickers.map(getYahooSymbol);
  
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

      const quote = quotes.find(q => q.symbol === getYahooSymbol(ticker));
      
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
  try {
    const tenantDb = await getTenantDb();
    return await tenantDb.select().from(transactions).orderBy(desc(transactions.id));
  } catch (error) {
    return [];
  }
}

// Eliminar un movimiento específico
export async function deleteTransactionData(id: number) {
  try {
    const tenantDb = await getTenantDb();

    // 1. Obtener la transacción que se intenta eliminar para saber el ticker y tipo
    const txToDelete = await tenantDb.select().from(transactions).where(eq(transactions.id, id)).get();
    
    if (!txToDelete) {
      return { success: false, error: "Transacción no encontrada." };
    }

    // 2. Si es una COMPRA, validamos que su eliminación no rompa el historial futuro
    if (txToDelete.type === 'COMPRA') {
      // Traemos todo el historial del activo, ordenado cronológicamente
      const allAssetTx = await tenantDb
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
    await tenantDb.delete(transactions).where(eq(transactions.id, id));
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

    const tenantDb = await getTenantDb();

    // Si están actualizando algo que afecta la cantidad, el tipo o el ticker...
    if (updateData.type === 'VENTA' || (updateData.ticker && updateData.quantity)) {
      const targetTicker = updateData.ticker ? updateData.ticker.split(" - ")[0].trim().toUpperCase() : undefined;
      
      // Si el tipo es VENTA, tenemos que hacer la validación
      if (updateData.type === 'VENTA' && targetTicker && updateData.quantity) {
        
        // Traemos todos los movimientos de ese ticker
        const allAssetTx = await tenantDb.select().from(transactions).where(eq(transactions.ticker, targetTicker));
        
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
      
      const existing = await tenantDb.select().from(assets).where(eq(assets.ticker, updateData.ticker)).get();
      
      if (!existing || existing.sector === "Otros" || !existing.sector) {
        try {
          const meta = await yf.quoteSummary(updateData.ticker, { modules: ["assetProfile", "quoteType", "fundProfile"] });
          
          const isETF = meta.quoteType?.quoteType === 'ETF';
          const assetSector = meta.assetProfile?.sector || meta.fundProfile?.categoryName || (isETF ? "ETF" : "Otros");

          if (!existing) {
            await tenantDb.insert(assets).values({
              ticker: updateData.ticker,
              name: meta.quoteType?.longName || updateData.ticker,
              sector: assetSector,
              location: meta.assetProfile?.country || "N/A",
              updatedAt: new Date(),
            });
          } else {
            await tenantDb.update(assets)
              .set({ sector: assetSector, updatedAt: new Date() })
              .where(eq(assets.ticker, updateData.ticker));
          }
        } catch (err) {
          console.error(`Error actualizando meta para ${updateData.ticker}:`, err);
        }
      }
    }

    await tenantDb.update(transactions)
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
  const tenantDb = await getTenantDb();

  const allTx = await tenantDb.select().from(transactions).orderBy(transactions.date);
  if (allTx.length === 0) return [];

  const uniqueTickers = Array.from(new Set(allTx.map(t => t.ticker)));
  const getYahooSymbol = (t: string) => t.includes('.') ? t : `${t.replace(/-/g, '')}.BA`;
  
  try {
    // 1. Fechas de inicio y fin
    const startDate = new Date(allTx[0].date + 'T00:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Formatear fechas para la API de Ámbito (YYYY-MM-DD)
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const startStr = formatDate(startDate);
    const todayStr = formatDate(today);

    // 2. OBTENER HISTORIAL DE DÓLAR CCL DESDE ÁMBITO
    const cclHistory: Record<string, number> = {};
    try {
      // Usamos el endpoint del Contado con Liqui
      const ambitoRes = await fetch(`https://mercados.ambito.com/dolar/contadoconliqui/historico-general/${startStr}/${todayStr}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        }
      });
      const ambitoData = await ambitoRes.json();
      
      // Ámbito devuelve: [["Fecha", "Compra", "Venta"], ["11-04-2024", "980,00", "1000,00"], ...]
      // Ignoramos la posición 0 que son los títulos
      for (let i = 1; i < ambitoData.length; i++) {
        const [fecha, compra, venta] = ambitoData[i];
        
        // Convertir "DD-MM-YYYY" a "YYYY-MM-DD" para que coincida con nuestro bucle
        const [day, month, year] = fecha.split('-');
        const dateKey = `${year}-${month}-${day}`;
        
        // Convertir "1.050,50" a número real 1050.50
        const parsedVenta = parseFloat(venta.replace(/\./g, '').replace(',', '.'));
        cclHistory[dateKey] = parsedVenta;
      }
    } catch (err) {
      console.error("Error obteniendo Dólar CCL de Ámbito:", err);
    }

    // Obtenemos el CCL actual (como respaldo de emergencia)
    const fallbackCCL = await getDolarCCL();

    // 3. OBTENER PRECIOS HISTÓRICOS SEMANALES CON YAHOO FINANCE
    const historicalPrices: Record<string, any[]> = {};
    await Promise.all(uniqueTickers.map(async (ticker) => {
      try {
        const symbol = getYahooSymbol(ticker);
        // Usamos chart() en lugar de historical()
        const chartData = await yf.chart(symbol, {
          period1: startDate,
          period2: today,
          interval: '1wk' 
        });
        // chart() devuelve un objeto, los precios están dentro de .quotes
        historicalPrices[ticker] = chartData.quotes || [];
      } catch (err) {
        console.error(`Error obteniendo historial para ${ticker}:`, err);
        historicalPrices[ticker] = [];
      }
    }));

    const evolutionData = [];
    
    // 4. Agrupar transacciones por fecha
    const txByDate: Record<string, typeof allTx> = {};
    for (const tx of allTx) {
      if (!txByDate[tx.date]) txByDate[tx.date] = [];
      txByDate[tx.date].push(tx);
    }

    const currentQuantities: Record<string, number> = {};
    const investedBasisPerTicker: Record<string, number> = {};
    
    let currentDate = new Date(startDate);
    let runningCCL = fallbackCCL; // Guarda el último CCL conocido

    // 5. ITERAR DÍA POR DÍA
    while (currentDate <= today) {
      const dateStr = formatDate(currentDate);

      // Si hay cotización del dólar para este día, la actualizamos.
      // Si es feriado o finde, usará el valor del último día hábil.
      if (cclHistory[dateStr]) {
        runningCCL = cclHistory[dateStr];
      }

      // Procesar compras/ventas del día
      if (txByDate[dateStr]) {
        for (const tx of txByDate[dateStr]) {
          const currentQty = currentQuantities[tx.ticker] || 0;
          const currentBasis = investedBasisPerTicker[tx.ticker] || 0;

          if (tx.type === 'COMPRA') {
            const cost = (tx.price * tx.quantity) + tx.commission;
            investedBasisPerTicker[tx.ticker] = currentBasis + cost;
            currentQuantities[tx.ticker] = currentQty + tx.quantity;
          } else if (tx.type === 'VENTA') {
            const ppc = currentQty > 0 ? currentBasis / currentQty : 0;
            const costOfSoldShares = ppc * tx.quantity;
            investedBasisPerTicker[tx.ticker] = Math.max(0, currentBasis - costOfSoldShares);
            currentQuantities[tx.ticker] = Math.max(0, currentQty - tx.quantity);
          }
        }
      }

      const dayOfWeek = currentDate.getDay();
      const isToday = currentDate.toDateString() === today.toDateString();

      // Guardamos en el gráfico si es VIERNES o si es el DÍA ACTUAL
      if (dayOfWeek === 5 || isToday) {
        let dailyCumulativeInvestment = 0;
        for (const basis of Object.values(investedBasisPerTicker)) {
          dailyCumulativeInvestment += basis;
        }

        let dailyMarketValue = 0;
        for (const [ticker, qty] of Object.entries(currentQuantities)) {
          if (qty > 0) {
            const history = historicalPrices[ticker] || [];
            
            // Buscar el precio en pesos más cercano del pasado
            let historicalPriceARS = 0;
            for (let i = history.length - 1; i >= 0; i--) {
              if (new Date(history[i].date) <= currentDate) {
                historicalPriceARS = history[i].close;
                break;
              }
            }

            if (!historicalPriceARS && history.length > 0) {
              historicalPriceARS = history[0].close;
            }

            // AHORA SÍ: Usamos el CCL real de ese momento específico de la historia
            const priceUSD = runningCCL > 1 ? historicalPriceARS / runningCCL : historicalPriceARS;
            dailyMarketValue += qty * priceUSD;
          }
        }

        evolutionData.push({
          date: new Date(currentDate), 
          invested: Number(dailyCumulativeInvestment.toFixed(2)),
          value: Number(dailyMarketValue.toFixed(2)),
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return evolutionData;
  } catch (error) {
    console.error("Error en getEvolutionData:", error);
    return [];
  }
}

export async function getHistoricalCCL(dateStr: string) {
  try {
    // 1. dateStr viene como YYYY-MM-DD. 
    // Pedimos un rango de 5 días hacia atrás por si el usuario eligió fin de semana o feriado.
    const targetDate = new Date(dateStr + 'T00:00:00');
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 5);

    // 2. Formateamos estrictamente a DD-MM-YYYY (el formato nativo de Ámbito)
    const formatAmbito = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const fromStr = formatAmbito(startDate);
    const toStr = formatAmbito(targetDate);

    const res = await fetch(`https://mercados.ambito.com/dolar/contadoconliqui/historico-general/${fromStr}/${toStr}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
      }
    });

    if (!res.ok) {
      return { success: false, error: "El servidor de cotizaciones rechazó la conexión temporalmente." };
    }

    const data = await res.json();
    
    // Ámbito devuelve: [["Fecha", "Compra", "Venta"], ["16-04-2025", "1000,00", "1020,00"], ...]
    if (Array.isArray(data) && data.length > 1) {
      
      // 3. Buscamos el registro más reciente dentro de los días que devolvió
      let bestRecord = data[1];
      let maxTime = 0;

      for (let i = 1; i < data.length; i++) {
        const [fecha, compra, venta] = data[i];
        const [day, month, year] = fecha.split('-');
        const recordTime = new Date(`${year}-${month}-${day}T00:00:00`).getTime();
        
        if (recordTime > maxTime) {
          maxTime = recordTime;
          bestRecord = data[i];
        }
      }

      const venta = bestRecord[2];
      const parsedVenta = parseFloat(venta.replace(/\./g, '').replace(',', '.'));
      
      // Devolvemos también la fecha real (realDate) por si tomó la del viernes
      return { success: true, ccl: parsedVenta, realDate: bestRecord[0] };
    } else {
      return { success: false, error: "Día ingresado fuera del mercado o sin cotización." };
    }
  } catch (error) {
    console.error("Error obteniendo CCL histórico:", error);
    return { success: false, error: "Error al consultar la cotización." };
  }
}