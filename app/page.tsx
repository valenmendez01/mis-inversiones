"use client";

import React, { useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
import useSWR from "swr";
import { getPortfolioData } from "./actions";
import PieChart from "@/components/charts/pie-chart";
import PieSlice from "@/components/charts/pie-slice";
import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "@/components/legend";

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

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartColors = ["#0ea5e9", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
  
  const pieChartData = portfolio.map((item: any, index: number) => ({
    label: item.ticker,
    value: item.currentValue,
    color: chartColors[index % chartColors.length]
  }));

  const totalCartera = pieChartData.reduce((acc: number, item: any) => acc + item.value, 0);

  const legendItems = pieChartData.map((d: any) => ({
    label: d.label,
    value: d.value, // Pasamos el valor numérico normal
    color: d.color,
  }));

  const totalInversion = useMemo(() => {
    return portfolio.reduce((acc: number, item: any) => acc + item.investment, 0);
  }, [portfolio]);

  const totalActual = useMemo(() => {
    return portfolio.reduce((acc: number, item: any) => acc + item.currentValue, 0);
  }, [portfolio]);

  const resultadoCash = totalActual - totalInversion;
  const resultadoPercent = totalInversion > 0 ? (totalActual / totalInversion - 1) * 100 : 0;
  const isGlobalPositive = resultadoCash >= 0;

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

        {/* Resumen y Gráfico de Distribución */}
        {pieChartData.length > 0 && (
          <section className="flex flex-col lg:flex-row items-center justify-between gap-8 mt-8">
            
            {/* LADO IZQUIERDO: 4 Cards (Grid 2x2) */}
            <div className="grid grid-cols-2 gap-4 w-full lg:w-1/2">
              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Total Inversión</p>
                  <p className="text-2xl font-bold mt-2">
                    $ {totalInversion.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Total Actual</p>
                  <p className="text-2xl font-bold mt-2">
                    $ {totalActual.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Resultado $</p>
                  <p className={`text-2xl font-bold mt-2 ${isGlobalPositive ? "text-success" : "text-danger"}`}>
                    {isGlobalPositive ? "+" : ""}$ {resultadoCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Resultado %</p>
                  <p className={`text-2xl font-bold mt-2 ${isGlobalPositive ? "text-success" : "text-danger"}`}>
                    {isGlobalPositive ? "+" : ""}{resultadoPercent.toFixed(2)}%
                  </p>
                </CardBody>
              </Card>
            </div>

            {/* LADO DERECHO: Pie Chart y Legend */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full lg:w-1/2">
              <PieChart
                data={pieChartData}
                size={280}
                hoveredIndex={hoveredIndex}
                onHoverChange={setHoveredIndex}
              >
                {pieChartData.map((_, index) => (
                  <PieSlice key={index} index={index} />
                ))}
              </PieChart>

              <Legend
                items={legendItems}
                hoveredIndex={hoveredIndex}
                onHoverChange={setHoveredIndex}
                title="Porcentaje de cartera"
              >
                <LegendItem className="flex items-center gap-3">
                  <LegendMarker />
                  <LegendLabel className="flex-1" />
                  <LegendValue 
                    formatValue={(v) => `${totalActual > 0 ? ((v / totalActual) * 100).toFixed(2) : "0.00"}%`} 
                  />
                </LegendItem>
              </Legend>
            </div>
            
          </section>
        )}
      </section>
    </div>
  );
}