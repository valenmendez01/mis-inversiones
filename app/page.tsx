"use client";

import React, { useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import useSWR from "swr";
import { getPortfolioData, getEvolutionData } from "./actions";
import PieChart from "@/components/charts/pie-chart";
import PieSlice from "@/components/charts/pie-slice";
import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "@/components/charts/legend";
import AreaChart, { Area } from "@/components/charts/area-chart";
import BarXAxis from "@/components/charts/bar-x-axis";
import Grid from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Skeleton } from "@heroui/skeleton";
import { Input } from "@heroui/input";
import { Search } from "lucide-react";
import BarChart from "@/components/charts/bar-chart";
import Bar from "@/components/charts/bar";
import XAxis from "@/components/charts/x-axis";
import PieCenter from "@/components/charts/pie-center";

const portfolioColumns = [
  { name: "TICKER", uid: "ticker", tooltip: "Símbolo identificador del activo en el mercado" },
  { name: "NOMBRE", uid: "name", tooltip: "Nombre de la empresa o fondo" },
  { name: "CANTIDAD", uid: "quantity", tooltip: "Cantidad de nominales (acciones/cedears) que posees" },
  { name: "INVERSIÓN", uid: "investment", tooltip: "Dinero total que invertiste en este activo" },
  { name: "VALOR ACTUAL", uid: "currentValue", tooltip: "Valor de mercado actual de tu posición" },
  { name: "PPC", uid: "ppc", tooltip: "Precio Promedio de Compra histórico" },
  { name: "CEDEAR", uid: "cedearValue", tooltip: "Precio actual de cotización del activo unitario" },
  { name: "DIF $", uid: "diffCash", tooltip: "Ganancia o pérdida latente en pesos" },
  { name: "DIF %", uid: "diffPercent", tooltip: "Porcentaje de rendimiento de la inversión latente" },
];

export default function InvestmentsPage() {
  // SWR maneja la petición y el estado de carga automáticamente
  const { data: portfolio = [], isLoading } = useSWR("portfolio", getPortfolioData);
  const { data: evolution = [] } = useSWR("evolution", getEvolutionData);
  // Estado para la búsqueda
  const [searchQuery, setSearchQuery] = useState("");

  // Lógica para filtrar el portfolio
  const filteredPortfolio = useMemo(() => {
    if (!searchQuery) return portfolio;
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    
    return portfolio.filter((item: any) => 
      item.ticker.toLowerCase().includes(lowerCaseQuery) || 
      item.name.toLowerCase().includes(lowerCaseQuery)
    );
  }, [portfolio, searchQuery]);

  const processedEvolution = useMemo(() => {
    return evolution.map((d: any) => ({
      ...d,
      // Convertimos el string ISO que viene del servidor a un objeto Date real
      date: new Date(d.date)
    })).filter(d => !isNaN(d.date.getTime())); // Filtramos posibles fechas rotas
  }, [evolution]);

  const [sortType, setSortType] = useState("significance");

  const profitLossData = useMemo(() => {
    const processed = portfolio.map((item: any) => ({
      ticker: item.ticker,
      diffCash: item.diffCash,
      currentValue: item.currentValue,
      Ganancia: item.diffCash >= 0 ? item.diffCash : undefined,
      Pérdida: item.diffCash < 0 ? Math.abs(item.diffCash) : undefined,
    }));

    // Ordenamos según la selección del usuario
    if (sortType === "significance") {
      processed.sort((a, b) => Math.abs(b.diffCash) - Math.abs(a.diffCash));
    } else {
      processed.sort((a, b) => b.currentValue - a.currentValue);
    }

    return processed.slice(0, 6);
  }, [portfolio, sortType]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartColors = ["#0ea5e9", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
  
  const pieChartData = useMemo(() => {
    if (portfolio.length === 0) return [];

    // 1. Ordenar por valor actual descendente
    const sortedPortfolio = [...portfolio].sort((a, b) => b.currentValue - a.currentValue);

    // 2. Tomar los 5 primeros
    const top5 = sortedPortfolio.slice(0, 5);
    const remaining = sortedPortfolio.slice(5);

    // 3. Formatear los top 5
    const data = top5.map((item, index) => ({
      label: item.ticker,
      value: item.currentValue,
      color: chartColors[index % chartColors.length]
    }));

    // 4. Agrupar el resto en "Otros" si existen
    if (remaining.length > 0) {
      const othersValue = remaining.reduce((acc, item) => acc + item.currentValue, 0);
      
      data.push({
        label: "Otros",
        value: othersValue,
        color: "#94a3b8" // Gris neutro para la categoría Otros
      });
    }

    return data;
  }, [portfolio]);

  // 5. Actualizar legendItems para que use la nueva data procesada
  const legendItems = useMemo(() => pieChartData.map((d) => ({
    label: d.label,
    value: d.value,
    color: d.color,
  })), [pieChartData]);

  const totalInversion = useMemo(() => {
    return portfolio.reduce((acc: number, item: any) => acc + item.investment, 0);
  }, [portfolio]);

  const totalActual = useMemo(() => {
    return portfolio.reduce((acc: number, item: any) => acc + item.currentValue, 0);
  }, [portfolio]);

  const resultadoCash = totalActual - totalInversion;
  const resultadoPercent = totalInversion > 0 ? (totalActual / totalInversion - 1) * 100 : 0;
  const isGlobalPositive = resultadoCash >= 0;

  // PAGINACIÓN

  const [page, setPage] = useState(1);
  const rowsPerPage = 5; // Máximo de filas

  // Calcular el total de páginas BASADO EN LOS RESULTADOS FILTRADOS
  const pages = Math.ceil(filteredPortfolio.length / rowsPerPage) || 1;

  // Obtener solo los items de la página actual BASADO EN LOS RESULTADOS FILTRADOS
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredPortfolio.slice(start, end);
  }, [page, filteredPortfolio]);

  // --- Sumamos la ganancia ya realizada de todos los activos ---
  const totalRealizedGain = useMemo(() => {
    return portfolio.reduce((acc: number, item: any) => acc + (item.realizedGain || 0), 0);
  }, [portfolio]);

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

  // SKELETONS DE CARGA
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-4">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
            <h2 className="text-3xl font-bold">Portfolio</h2>
            <Skeleton className="w-full sm:w-[300px] h-10 rounded-medium" />
          </div>
          
          {/* Skeleton de la Tabla */}
          <Skeleton className="w-full h-[400px] rounded-xl" />

          {/* Skeleton de las Cards y Distribución */}
          <section className="flex flex-col lg:flex-row items-center justify-between gap-8 mt-8">
            
            {/* LADO IZQUIERDO: 4 Cards (Grid 2x2) */}
            <div className="grid grid-cols-2 gap-4 w-full lg:w-1/2">
              <Skeleton className="h-[104px] w-full rounded-xl" />
              <Skeleton className="h-[104px] w-full rounded-xl" />
              <Skeleton className="h-[104px] w-full rounded-xl" />
              <Skeleton className="h-[104px] w-full rounded-xl" />
            </div>

            {/* LADO DERECHO: Pie Chart y Legend */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full lg:w-1/2">
              {/* Skeleton circular usando rounded-full */}
              <Skeleton className="w-[280px] h-[280px] rounded-full" />
              {/* Skeleton de la leyenda */}
              <Skeleton className="w-[200px] h-[150px] rounded-xl" />
            </div>
          </section>

          {/* Skeletons para los gráficos inferiores (opcional para mantener la estructura) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 mb-8">
            <Skeleton className="w-full h-[300px] rounded-xl" />
            <Skeleton className="w-full h-[300px] rounded-xl" />
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-4">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
          <h2 className="text-3xl font-bold">Portfolio</h2>
          
          <div className="flex justify-start sm:justify-end w-full sm:w-auto">
            <Input
              isClearable
              aria-label="Buscar en portfolio"
              className="w-full sm:w-[300px]"
              placeholder="Buscar por ticker o nombre..."
              startContent={<Search size={18} className="text-default-400" />}
              value={searchQuery}
              onClear={() => {
                setSearchQuery("");
                setPage(1); // Volver a la página 1 al limpiar
              }}
              onValueChange={(value) => {
                setSearchQuery(value);
                setPage(1); // Volver a la página 1 al escribir
              }}
              variant="bordered"
            />
          </div>
        </div>
        <Table 
          aria-label="Tabla de portfolio"
          classNames={{
            wrapper: "min-h-[400px]", 
          }}
          bottomContent={
            pages > 1 ? (
              <div className="flex w-full justify-center">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  color="primary"
                  page={page}
                  total={pages}
                  onChange={(page) => setPage(page)}
                />
              </div>
            ) : null
          }
        >
          <TableHeader columns={portfolioColumns}>
            {(col) => (
              <TableColumn key={col.uid}>
                <Tooltip 
                  content={col.tooltip} 
                  placement="top" 
                  showArrow
                >
                  <span>
                    {col.name}
                  </span>
                </Tooltip>
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={items} emptyContent={isLoading ? "Cargando..." : "Sin datos en el portfolio"}>
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
                  <Tooltip content="Suma total del capital invertido en los activos que posees actualmente." placement="top" showArrow>
                    <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Total Inversión</p>
                  </Tooltip>
                  <p className="text-xl font-bold mt-2">
                    $ {totalInversion.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <Tooltip content="Dinero neto ganado (o perdido) proveniente de las ventas ya ejecutadas." placement="top" showArrow>
                    <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Ganancia Realizada</p>
                  </Tooltip>
                  <p className={`text-xl font-bold mt-2 ${totalRealizedGain >= 0 ? "text-success" : "text-danger"}`}>
                  {totalRealizedGain >= 0 ? "+" : ""}$ {totalRealizedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <Tooltip content="Ganancia o pérdida latente actual (Valor Actual - Total Inversión)." placement="top" showArrow>
                    <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Resultado $</p>
                  </Tooltip>
                  <p className={`text-xl font-bold mt-2 ${isGlobalPositive ? "text-success" : "text-danger"}`}>
                    {isGlobalPositive ? "+" : ""}$ {resultadoCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                  <Tooltip content="Rendimiento porcentual de tu inversión activa actual." placement="top" showArrow>
                    <p className="text-sm text-default-500 uppercase font-bold tracking-wider">Resultado %</p>
                  </Tooltip>
                  <p className={`text-xl font-bold mt-2 ${isGlobalPositive ? "text-success" : "text-danger"}`}>
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
                innerRadius={70}
                hoveredIndex={hoveredIndex}
                onHoverChange={setHoveredIndex}
              >
                {pieChartData.map((_, index) => (
                  <PieSlice key={index} index={index} />
                ))}
              
                <PieCenter 
                  defaultLabel="Total Actual" 
                  prefix="$ "
                />
              </PieChart>

              <Legend
                items={legendItems}
                hoveredIndex={hoveredIndex}
                onHoverChange={setHoveredIndex}
                title="Distribución de Cartera"
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

        {/* NUEVA SECCIÓN: Gráficos de Rendimiento */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 mb-8">
          
          {/* AREA CHART: Evolución de Inversión vs Valor */}
          <Card className="p-4">
            <h3 className="text-xl font-bold p-4">Evolución de Patrimonio</h3>
            <div className="h-[300px] w-full">
              <AreaChart data={processedEvolution}>
                <Grid horizontal />
                <Area 
                  dataKey="value"
                  fill="var(--chart-line-primary)" 
                  stroke="#0ea5e9"
                />
                <Area 
                  dataKey="invested"  
                  fill="var(--chart-line-secondary)" 
                  stroke="#64748b"
                />
                <XAxis />
                <ChartTooltip 
                  showDots={true} // Asegura que los círculos en los puntos de datos estén activos
                  rows={(point) => [
                    { 
                      // Color del dot para la primera serie (debe ser un color visible o variable CSS)
                      color: "#0ea5e9", 
                      label: "Valor Mercado", 
                      value: `$ ${Number(point.value).toLocaleString()}` 
                    },
                    { 
                      // Color del dot para la segunda serie
                      color: "#64748b", 
                      label: "Total Invertido", 
                      value: `$ ${Number(point.invested).toLocaleString()}` 
                    },
                  ]}  
                />
              </AreaChart>
            </div>
          </Card>

          {/* BAR CHART: Profit por Activo */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4">
              <h3 className="text-xl font-bold">Rendimiento por Activo</h3>
              <Select
                aria-label="Seleccionar modo de visualización"
                className="max-w-[200px]"
                disallowEmptySelection
                selectedKeys={[sortType]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => setSortType(Array.from(keys)[0] as string)}
              >
                <SelectItem key="significance" textValue="Más Significativos">
                  Más Significativos
                </SelectItem>
                <SelectItem key="portfolio" textValue="Mayor % Cartera">
                  Mayor % Cartera
                </SelectItem>
              </Select>
            </div>

            <div className="h-[250px] w-full mt-4">
              <BarChart data={profitLossData} xDataKey="ticker" stacked>
                <Grid horizontal />
                <Bar dataKey="Ganancia" fill="#10b981" lineCap="round" />
                <Bar dataKey="Pérdida" fill="#ef4444" lineCap="round" />
                <BarXAxis />
                <ChartTooltip
                  rows={(point) => [
                    point.Ganancia !== undefined && {
                      color: "#10b981",
                      label: "Ganancia",
                      value: `$ ${Number(point.Ganancia).toLocaleString()}`,
                    },
                    point.Pérdida !== undefined && {
                      color: "#ef4444",
                      label: "Pérdida",
                      value: `$ ${Number(point.Pérdida).toLocaleString()}`,
                    },
                  ].filter(Boolean) as any}
                />
              </BarChart>
            </div>
          </Card>
        </section>
      </section>
    </div>
  );
}