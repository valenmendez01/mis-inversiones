"use client";

import React, { useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
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
  { name: "TIPO", uid: "type" },
  { name: "ACCIONES", uid: "actions" },
];

export function MovementsTable() {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const { 
    isOpen: isDeleteOpen, 
    onOpen: onDeleteOpen, 
    onClose: onDeleteClose, 
    onOpenChange: onDeleteOpenChange 
  } = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  // Estado para el filtro (Por defecto "date_asc")
  const [filterType, setFilterType] = useState("date_desc");
  
  // SWR se encarga de todo el ciclo de vida de los datos
  const { data: movements = [], isLoading } = useSWR("movements", getTransactionsData);

  const confirmDelete = (id: number) => {
    setItemToDelete(id);
    onDeleteOpen();
  };

  const executeDelete = async () => {
    if (itemToDelete !== null) {
      setDeleteError(null); // Limpiamos errores previos
      
      const response = await deleteTransactionData(itemToDelete);
      
      if (response.success) {
        mutate("movements");
        mutate("portfolio");
        setItemToDelete(null);
        onDeleteClose();
      } else {
        // Mostramos el mensaje de error que viene del servidor
        setDeleteError(response.error || "Ocurrió un error al eliminar.");
      }
    }
  };

  const [page, setPage] = useState(1); // Estado para la página actual
  const rowsPerPage = 10; // Máximo de filas solicitado

  // Lógica para filtrar y ordenar
  const processedMovements = useMemo(() => {
    let result = [...movements];

    switch (filterType) {
      case "date_desc":
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "date_asc":
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "type_compra":
        result = result.filter((m) => m.type === "COMPRA");
        // Orden secundario por fecha para mantener todo organizado
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "type_venta":
        result = result.filter((m) => m.type === "VENTA");
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "ticker":
        result.sort((a, b) => a.ticker.localeCompare(b.ticker));
        break;
    }

    return result;
  }, [movements, filterType]);

  const pages = Math.ceil(processedMovements.length / rowsPerPage) || 1;

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return processedMovements.slice(start, end);
  }, [page, processedMovements]);

  const renderMovementCell = (item: any, columnKey: React.Key) => {
    switch (columnKey) {
      case "price": return `$ ${item.price.toLocaleString()}`;
      case "commission": return `$ ${item.commission.toLocaleString()}`;
      case "date":
        return new Date(item.date + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
      case "type":
        return (
          <Chip 
            color={item.type === "COMPRA" ? "success" : "danger"} 
            variant="flat" 
            size="sm"
          >
            {item.type}
          </Chip>
        );
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <span 
              className="text-lg text-default-400 cursor-pointer active:opacity-50"
              onClick={() => {
                setSelectedMovement(item);
                onOpen();
              }}
            >
              <Pencil size={18} />
            </span>

            <span 
              className="text-lg text-danger cursor-pointer active:opacity-50"
              onClick={() => confirmDelete(item.id)} // <--- MODIFICAR ESTA LÍNEA
            >
              <Trash2 size={18} />
            </span>

          </div>
        );
      default: return item[columnKey as keyof typeof item];
    }
  };

  // SKELETONS DE CARGA
  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        {/* Header simulado con Skeletons para el Select y el Botón */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-3xl font-bold">Movimientos</h2>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Skeleton del Select (ancho 48 que equivale a w-48) */}
            <Skeleton className="w-48 h-10 rounded-medium" />
            
            {/* Skeleton del Botón "Agregar Inversión" */}
            <Skeleton className="w-[170px] h-10 rounded-medium" />
          </div>
        </div>
        
        {/* Skeleton de la Tabla */}
        <Skeleton className="w-full h-[400px] rounded-xl" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold">Movimientos</h2>
        
        <div className="flex flex-wrap gap-4 items-center">
          <Select
            aria-label="Filtrar movimientos"
            className="w-48"
            disallowEmptySelection
            selectedKeys={[filterType]}
            variant="bordered"
            onChange={(e) => {
              if (e.target.value) {
                setFilterType(e.target.value);
                setPage(1); // Reiniciar a la página 1 cuando se cambia el filtro
              }
            }}
          >
            <SelectItem key="date_desc">Fecha descendente</SelectItem>
            <SelectItem key="date_asc">Fecha ascendente</SelectItem>
            <SelectItem key="type_compra">Solo compras</SelectItem>
            <SelectItem key="type_venta">Solo ventas</SelectItem>
            <SelectItem key="ticker">Por ticker (A-Z)</SelectItem>
          </Select>

          <Button color="primary" onPress={onOpen} endContent={<Plus size={18} />}>
            Agregar
          </Button>
        </div>
      </div>
      
      <Table 
        aria-label="Tabla de movimientos"
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
        <TableHeader columns={movementColumns}>
          {(col) => <TableColumn key={col.uid}>{col.name}</TableColumn>}
        </TableHeader>
        <TableBody items={items} emptyContent={isLoading ? "Cargando..." : "Sin movimientos"}>
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

      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">¿Estás seguro?</ModalHeader>
              <ModalBody>
                <p>Estás a punto de eliminar este movimiento. Esta acción no se puede deshacer.</p>
                <p className="text-sm text-default-500">
                  Ten en cuenta que esto recalculará tu portfolio automáticamente.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="danger" onPress={executeDelete}>
                  Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </section>
  );
}