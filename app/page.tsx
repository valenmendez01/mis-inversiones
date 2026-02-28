"use client";

import React from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import useSWR from "swr"; // <-- Importamos SWR

import { getPortfolioData } from "./actions";
import { RadarChartDemo } from "@/components/radar-chart-demo";

const portfolioColumns = [
  { name: "TICKER", uid: "ticker" },
  { name: "NOMBRE", uid: "name" },
  { name: "CANTIDAD", uid: "quantity" },
  { name: "INVERSIÓN", uid: "investment" },
  { name: "VALOR ACTUAL", uid: "currentValue" },
  { name: "PPC", uid: "ppc" },
  { name: "CEDEAR", uid: "cedearValue" },
  { name: "DIF $", uid: "diffCash" },
  { name: "DIF %", uid: "diffPercent" },
];

export default function InvestmentsPage() {
  // SWR maneja la petición y el estado de carga automáticamente
  const { data: portfolio = [], isLoading } = useSWR("portfolio", getPortfolioData);

  const renderPortfolioCell = (item: any, columnKey: React.Key) => {
    const isPositive = item.diffCash >= 0;
    switch (columnKey) {
      case "ticker":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-sm">{item.ticker}</p>
            <p className="text-tiny text-default-400">{item.sector}</p>
          </div>
        );
      case "investment": return `$ ${item.investment.toLocaleString()}`;
      case "currentValue": return `$ ${item.currentValue.toLocaleString()}`;
      case "ppc": return `$ ${item.ppc.toLocaleString()}`;
      case "cedearValue": 
        return `$ ${item.cedearValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "diffCash":
        return (
          <span className={isPositive ? "text-success" : "text-danger"}>
            $ {item.diffCash.toLocaleString()}
          </span>
        );
      case "diffPercent":
        return (
          <Chip color={isPositive ? "success" : "danger"} variant="flat" size="sm">
            {isPositive ? "+" : ""}{item.diffPercent.toFixed(2)}%
          </Chip>
        );
      default: return item[columnKey as keyof typeof item];
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-4">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Mi Portfolio</h2>
        <Table aria-label="Tabla de portfolio">
          <TableHeader columns={portfolioColumns}>
            {(col) => <TableColumn key={col.uid}>{col.name}</TableColumn>}
          </TableHeader>
          <TableBody items={portfolio} emptyContent={isLoading ? "Cargando..." : "Sin datos en el portfolio"}>
            {(item) => (
              <TableRow key={item.ticker}>
                {(key) => <TableCell>{renderPortfolioCell(item, key)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
        <RadarChartDemo/>
      </section>
    </div>
  );
}