"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Trash2, Plus, Search } from "lucide-react";

import { searchTickers, addTransaction, getPortfolioData, getTransactionsData, deleteTransactionData } from "./actions";

// Columnas para la tabla de Movimientos
const movementColumns = [
  { name: "TICKER", uid: "ticker" },
  { name: "PRECIO", uid: "price" },
  { name: "CANTIDAD", uid: "quantity" },
  { name: "COMISIÓN", uid: "commission" },
  { name: "FECHA", uid: "date" },
  { name: "ACCIONES", uid: "actions" },
];

// Columnas para la tabla de Portfolio
const portfolioColumns = [
  { name: "TICKER", uid: "ticker" },
  { name: "NOMBRE", uid: "name" },
  { name: "CANTIDAD", uid: "quantity" },
  { name: "PPC", uid: "ppc" },
  { name: "INVERSIÓN", uid: "investment" },
  { name: "VALOR ACTUAL", uid: "currentValue" },
  { name: "DIF $", uid: "diffCash" },
  { name: "DIF %", uid: "diffPercent" },
];

export default function InvestmentsPage() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [movements, setMovements] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para el formulario y búsqueda
  const [tickerSearch, setTickerSearch] = useState("");
  const [tickerResults, setTickerResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formState, setFormState] = useState({
    ticker: "",
    price: "",
    quantity: "",
    commission: "0",
    date: new Date().toISOString().split('T')[0],
  });

  // Cargar datos de ambas tablas
  const loadAllData = async () => {
    setIsLoading(true);
    const [mvs, pf] = await Promise.all([
      getTransactionsData(), // Debes asegurar que esta función exista en actions.ts para traer el historial
      getPortfolioData()
    ]);
    setMovements(mvs);
    setPortfolio(pf);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Cálculo automático de comisión (0.8%)
  useEffect(() => {
    const p = parseFloat(formState.price);
    const q = parseFloat(formState.quantity);
    if (p && q) {
      setFormState(prev => ({ ...prev, commission: (p * q * 0.008).toFixed(2) }));
    }
  }, [formState.price, formState.quantity]);

  // Manejo de búsqueda de tickers para el Autocomplete
  const handleTickerSearch = async (value: string) => {
    if (!value || value.length < 2) {
      setTickerResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchTickers(value);
      setTickerResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, onClose: () => void) => {
    e.preventDefault();
    await addTransaction({
      ticker: formState.ticker,
      price: Number(formState.price),
      quantity: Number(formState.quantity),
      commission: Number(formState.commission),
      date: formState.date,
    });
    await loadAllData();
    onClose();
  };

  // Renderizado de celdas para Movimientos
  const renderMovementCell = (item: any, columnKey: React.Key) => {
    switch (columnKey) {
      case "price": return `$ ${item.price.toLocaleString()}`;
      case "commission": return `$ ${item.commission.toLocaleString()}`;
      case "actions":
        return (
          <Tooltip color="danger" content="Eliminar movimiento">
            <span className="text-lg text-danger cursor-pointer" onClick={async () => {
              await deleteTransactionData(item.id);
              loadAllData();
            }}>
              <Trash2 size={18} />
            </span>
          </Tooltip>
        );
      default: return item[columnKey as keyof typeof item];
    }
  };

  // Renderizado de celdas para Portfolio
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
      case "ppc": return `$ ${item.ppc.toFixed(2)}`;
      case "investment": return `$ ${item.investment.toLocaleString()}`;
      case "currentValue": return `$ ${item.currentValue.toLocaleString()}`;
      case "diffCash":
        return (
          <span className={isPositive ? "text-success" : "text-danger"}>
            {isPositive ? "+" : ""}$ {item.diffCash.toLocaleString()}
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
      {/* Sección Movimientos */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Historial de Movimientos</h2>
          <Button color="primary" onPress={onOpen} endContent={<Plus size={18} />}>
            Agregar Inversión
          </Button>
        </div>
        <Table aria-label="Tabla de movimientos">
          <TableHeader columns={movementColumns}>
            {(col) => <TableColumn key={col.uid}>{col.name}</TableColumn>}
          </TableHeader>
          <TableBody items={movements} emptyContent={isLoading ? "Cargando..." : "Sin movimientos"}>
            {(item) => (
              <TableRow key={item.id}>
                {(key) => <TableCell>{renderMovementCell(item, key)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Sección Portfolio */}
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
      </section>

      {/* Modal Agregar Inversión */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {(onClose) => (
            <form onSubmit={(e) => handleSubmit(e, onClose)}>
              <ModalHeader>Registrar Nueva Compra</ModalHeader>
              <ModalBody>
                <Autocomplete
                  isRequired
                  label="Ticker"
                  placeholder="Busca un activo (ej: AAPL, ALUA.BA)"
                  isLoading={isSearching}
                  items={tickerResults}
                  allowsCustomValue
                  onInputChange={(value) => {
                    if (value.length >= 2) handleTickerSearch(value);
                    else setTickerResults([]);
                  }}
                  onSelectionChange={(key) => {
                    if (key) setFormState(prev => ({ ...prev, ticker: key as string }));
                  }}
                >
                  {(item: any) => (
                    <AutocompleteItem key={item.key}>
                      {item.label}
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <div className="flex gap-2">
                  <Input 
                    isRequired label="Precio" type="number" step="0.01" 
                    value={formState.price} onValueChange={(v) => setFormState({...formState, price: v})} 
                  />
                  <Input 
                    isRequired label="Cantidad" type="number" step="0.01" 
                    value={formState.quantity} onValueChange={(v) => setFormState({...formState, quantity: v})} 
                  />
                </div>
                <Input 
                  label="Comisión (Calculada 0.8%)" value={`$ ${formState.commission}`} 
                  isDisabled variant="faded" 
                />
                <Input 
                  isRequired label="Fecha" type="date" 
                  value={formState.date} onValueChange={(v) => setFormState({...formState, date: v})} 
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancelar</Button>
                <Button color="primary" type="submit">Guardar Movimiento</Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}