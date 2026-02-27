"use client";

import React, { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Edit2Icon, Eye, Trash2, Plus } from "lucide-react";

import { type Cedear } from "../schema"; 
import { calculatePerformance } from "./utils/finance"; 
import { getCedearsData, addCedearData, deleteCedearData, updateCedearData } from "./actions"; 

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
  const [editingItem, setEditingItem] = useState<Cedear | null>(null);
  

  // Estado controlado para los valores del formulario
  const [formState, setFormState] = useState({
    ticker: "",
    pesosSpent: "",
    cclPurchase: "",
    pesosCurrent: "",
    cclCurrent: "",
    purchaseDate: "",
  });

  const { 
    isOpen: isDeleteOpen, 
    onOpen: onDeleteOpen, 
    onClose: onDeleteClose 
  } = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // Carga inicial de datos desde Turso
  const loadData = async () => {
    setIsLoading(true);
    const result = await getCedearsData();
    setData(result);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sincroniza el formulario cuando se abre el modal o cambia el ítem a editar
  useEffect(() => {
    if (editingItem && isOpen) {
      setFormState({
        ticker: editingItem.ticker,
        pesosSpent: editingItem.pesosSpent.toString(),
        cclPurchase: editingItem.cclPurchase.toString(),
        pesosCurrent: editingItem.pesosCurrent.toString(),
        cclCurrent: editingItem.cclCurrent.toString(),
        purchaseDate: editingItem.purchaseDate,
      });
    } else if (!editingItem && isOpen) {
      setFormState({
        ticker: "",
        pesosSpent: "",
        cclPurchase: "",
        pesosCurrent: "",
        cclCurrent: "",
        purchaseDate: "",
      });
    }
  }, [editingItem, isOpen]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    onOpen();
  };

  const handleEdit = (item: Cedear) => {
    setEditingItem(item);
    onOpen();
  };

  // Esta función solo abre el modal y guarda el ID
  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    onDeleteOpen();
  };

  // Esta función se ejecuta cuando el usuario confirma en el modal
  const confirmDelete = async () => {
    if (itemToDelete !== null) {
      await deleteCedearData(itemToDelete);
      await loadData();
      setItemToDelete(null);
      onDeleteClose(); // Cierra el modal
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, onClose: () => void) => {
    e.preventDefault();
    
    const cedearData = {
      ticker: formState.ticker.toUpperCase(),
      pesosSpent: Number(formState.pesosSpent),
      cclPurchase: Number(formState.cclPurchase),
      pesosCurrent: Number(formState.pesosCurrent),
      cclCurrent: Number(formState.cclCurrent),
      purchaseDate: formState.purchaseDate,
    };

    if (editingItem) {
      await updateCedearData(editingItem.id, cedearData);
    } else {
      await addCedearData(cedearData);
    }

    await loadData(); 
    onClose(); 
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
            <Tooltip content="Editar inversión">
              <span 
                className="text-lg text-default-400 cursor-pointer active:opacity-50"
                onClick={() => handleEdit(item)}
              >
                <Edit2Icon size={18} />
              </span>
            </Tooltip>
            <Tooltip color="danger" content="Eliminar registro">
              <span 
                className="text-lg text-danger cursor-pointer active:opacity-50"
                onClick={() => handleDeleteClick(item.id)}
              >
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mis Ganancias</h1>
        <Button color="primary" onPress={handleOpenAdd} endContent={<Plus size={18} />}>
          Agregar Inversión
        </Button>
      </div>

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

      {/* Modal de Registro / Actualización */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {(onClose) => (
            <form onSubmit={(e) => handleSubmit(e, onClose)}>
              <ModalHeader className="flex flex-col gap-1">
                {editingItem ? "Editar inversión" : "Registrar nueva compra"}
              </ModalHeader>
              <ModalBody>
                <Input 
                  isRequired autoFocus label="Ticker" placeholder="Ej: AAPL" variant="bordered"
                  value={formState.ticker} 
                  onValueChange={(val) => setFormState({ ...formState, ticker: val })}
                />
                <div className="flex gap-2">
                  <Input 
                    isRequired type="number" step="0.01" label="Pesos Gastados" placeholder="Ej: 150000" variant="bordered"
                    value={formState.pesosSpent} 
                    onValueChange={(val) => setFormState({ ...formState, pesosSpent: val })}
                  />
                  <Input 
                    isRequired type="number" step="0.01" label="CCL al Comprar" placeholder="Ej: 1050.50" variant="bordered"
                    value={formState.cclPurchase} 
                    onValueChange={(val) => setFormState({ ...formState, cclPurchase: val })}
                  />
                </div>
                <div className="flex gap-2">
                  <Input 
                    isRequired type="number" step="0.01" label="Valor Actual (ARS)" placeholder="Ej: 210000" variant="bordered"
                    value={formState.pesosCurrent} 
                    onValueChange={(val) => setFormState({ ...formState, pesosCurrent: val })}
                  />
                  <Input 
                    isRequired type="number" step="0.01" label="CCL Actual" placeholder="Ej: 1200" variant="bordered"
                    value={formState.cclCurrent} 
                    onValueChange={(val) => setFormState({ ...formState, cclCurrent: val })}
                  />
                </div>
                <Input 
                  isRequired type="date" label="Fecha de Compra" variant="bordered"
                  value={formState.purchaseDate} 
                  onValueChange={(val) => setFormState({ ...formState, purchaseDate: val })}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" type="submit">
                  {editingItem ? "Actualizar" : "Guardar"}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} placement="center" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-danger">
                Confirmar Eliminación
              </ModalHeader>
              <ModalBody>
                <p>
                  ¿Estás seguro de que querés eliminar esta inversión? Esta acción no se puede deshacer y los datos se borrarán permanentemente.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="danger" onPress={confirmDelete}>
                  Sí, eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}