"use client";

import React, { useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { useDisclosure } from "@heroui/modal";
import { Trash2, Plus, Pencil } from "lucide-react";
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
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  
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
      case "date":
        return new Date(item.date + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
      case "actions":
        return (
          <div className="flex gap-5">
            <Tooltip content="Editar movimiento">
              <span className="text-lg text-default-400 cursor-pointer" onClick={() => { setSelectedMovement(item); onOpen(); }}>
                <Pencil size={18} />
              </span>
            </Tooltip>
            <Tooltip color="danger" content="Eliminar movimiento">
              <span className="text-lg text-danger cursor-pointer" onClick={() => handleDelete(item.id)}>
                <Trash2 size={18} />
              </span>
            </Tooltip>
          </div>
        );
      default: return item[columnKey as keyof typeof item];
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Movimientos</h2>
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

      <InvestmentModal 
        isOpen={isOpen} 
        onOpenChange={(open) => { onOpenChange(); if (!open) setSelectedMovement(null); }}
        initialData={selectedMovement}
      />
    </section>
  );
}