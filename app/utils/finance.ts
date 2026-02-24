// src/utils/finance.ts

// Asegúrate de ajustar la ruta de importación según dónde esté tu schema.ts
import { type Cedear } from "../../schema"; 

export function calculatePerformance(item: Cedear) {
  const initialUsd = item.pesosSpent / item.cclPurchase;
  const currentUsd = item.pesosCurrent / item.cclCurrent;
  const profitUsd = currentUsd - initialUsd;
  const profitPercentage = (profitUsd / initialUsd) * 100;

  return {
    initialUsd,
    currentUsd,
    profitUsd,
    profitPercentage,
    isPositive: profitUsd >= 0,
  };
}