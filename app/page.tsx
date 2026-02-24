"use client";

import React, { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Edit2Icon, Eye, Trash2, Plus } from "lucide-react";

import { type Cedear } from "../schema"; // Ajusta la ruta
import { calculatePerformance } from "./utils/finance"; // Ajusta la ruta
import { getCedearsData, addCedearData } from "./actions"; // Ajusta la ruta

export const columns = [
  { name: "TICKER", uid: "ticker" },
  { name: "INVERSIÓN (USD)", uid: "initialUsd" },
  { name: "VALOR ACTUAL (USD)", uid: "currentUsd" },
  { name: "RENDIMIENTO", uid: "profit" },
  { name: "ACCIONES", uid: "actions" },
];

export default function CedearsTable() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [data, setData] = useState<Cedear[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos reales de Turso
  const loadData = async () => {
    setIsLoading(true);
    const result = await getCedearsData();
    setData(result);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, onClose: () => void) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newCedear = {
      ticker: (formData.get("ticker") as string).toUpperCase(),
      pesosSpent: Number(formData.get("pesosSpent")),
      cclPurchase: Number(formData.get("cclPurchase")),
      pesosCurrent: Number(formData.get("pesosCurrent")),
      cclCurrent: Number(formData.get("cclCurrent")),
      purchaseDate: formData.get("purchaseDate") as string,
    };

    await addCedearData(newCedear);
    await loadData(); // Refresca la tabla
    onClose(); // Cierra el modal
  };

  const renderCell = React.useCallback((item: Cedear, columnKey: React.Key) => {
    const perf = calculatePerformance(item);

    switch (columnKey) {
      case "ticker":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-sm">{item.ticker}</p>
            <p className="text-tiny text-default-400">{item.purchaseDate}</p>
          </div>
        );
      case "initialUsd":
        return <p className="text-sm">u$s {perf.initialUsd.toFixed(2)}</p>;
      case "currentUsd":
        return <p className="text-sm">u$s {perf.currentUsd.toFixed(2)}</p>;
      case "profit":
        return (
          <Chip
            className="capitalize"
            color={perf.isPositive ? "success" : "danger"}
            size="sm"
            variant="flat"
          >
            {perf.profitUsd > 0 ? "+" : ""}u$s {perf.profitUsd.toFixed(2)} ({perf.profitPercentage.toFixed(2)}%)
          </Chip>
        );
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <Tooltip content="Ver detalles">
              <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                <Eye size={18} />
              </span>
            </Tooltip>
            <Tooltip content="Editar inversión">
              <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                <Edit2Icon size={18} />
              </span>
            </Tooltip>
            <Tooltip color="danger" content="Eliminar registro">
              <span className="text-lg text-danger cursor-pointer active:opacity-50">
                <Trash2 size={18} />
              </span>
            </Tooltip>
          </div>
        );
      default:
        return null;
    }
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto p-4">
      {/* Cabecera con el botón Agregar */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mis Ganancias</h1>
        <Button color="primary" onPress={onOpen} endContent={<Plus size={18} />}>
          Agregar Inversión
        </Button>
      </div>

      {/* Tabla */}
      <Table aria-label="Tabla de rendimientos de CEDEARs">
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={data} emptyContent={isLoading ? "Cargando datos..." : "No hay inversiones registradas."}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Modal Formulario */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {(onClose) => (
            <form onSubmit={(e) => handleSubmit(e, onClose)}>
              <ModalHeader className="flex flex-col gap-1">Registrar nueva compra</ModalHeader>
              <ModalBody>
                <Input isRequired autoFocus name="ticker" label="Ticker" placeholder="Ej: AAPL" variant="bordered" />
                <div className="flex gap-2">
                  <Input isRequired type="number" step="0.01" name="pesosSpent" label="Pesos Gastados" placeholder="Ej: 150000" variant="bordered" />
                  <Input isRequired type="number" step="0.01" name="cclPurchase" label="CCL al Comprar" placeholder="Ej: 1050.50" variant="bordered" />
                </div>
                <div className="flex gap-2">
                  <Input isRequired type="number" step="0.01" name="pesosCurrent" label="Valor Actual (ARS)" placeholder="Ej: 210000" variant="bordered" />
                  <Input isRequired type="number" step="0.01" name="cclCurrent" label="CCL Actual" placeholder="Ej: 1200" variant="bordered" />
                </div>
                <Input isRequired type="date" name="purchaseDate" label="Fecha de Compra" variant="bordered" />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" type="submit">
                  Guardar
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}