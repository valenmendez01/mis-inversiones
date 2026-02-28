"use client";

import React from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { useDisclosure } from "@heroui/modal";
import { Trash2, Plus } from "lucide-react";
import useSWR, { mutate } from "swr"; // <-- Importamos SWR

import { getTransactionsData, deleteTransactionData } from "@/app/actions";
import { InvestmentModal } from "@/components/investment-modal"; 

const movementColumns = [
  { name: "TICKER", uid: "ticker" },
  { name: "PRECIO", uid: "price" },
  { name: "CANTIDAD", uid: "quantity" },
  { name: "COMISIÓN", uid: "commission" },
  { name: "FECHA", uid: "date" },
  { name: "ACCIONES", uid: "actions" },
];

export function MovementsTable() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  // SWR se encarga de todo el ciclo de vida de los datos
  const { data: movements = [], isLoading } = useSWR("movements", getTransactionsData);

  const handleDelete = async (id: number) => {
    await deleteTransactionData(id);
    // Invalidamos la caché de ambas tablas
    mutate("movements");
    mutate("portfolio");
  };

  const renderMovementCell = (item: any, columnKey: React.Key) => {
    switch (columnKey) {
      case "price": return `$ ${item.price.toLocaleString()}`;
      case "commission": return `$ ${item.commission.toLocaleString()}`;
      case "actions":
        return (
          <Tooltip color="danger" content="Eliminar movimiento">
            <span className="text-lg text-danger cursor-pointer" onClick={() => handleDelete(item.id)}>
              <Trash2 size={18} />
            </span>
          </Tooltip>
        );
      default: return item[columnKey as keyof typeof item];
    }
  };

  return (
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

      <InvestmentModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </section>
  );
}