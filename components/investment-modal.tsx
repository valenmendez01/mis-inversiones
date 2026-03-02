"use client";

import React, { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { parseDate } from "@internationalized/date";
import { DatePicker } from "@heroui/date-picker";
import { RadioGroup, Radio } from "@heroui/radio";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { I18nProvider } from "@react-aria/i18n";
import { mutate } from "swr";

import { searchTickers, addTransaction, updateTransactionData } from "@/app/actions";

interface InvestmentModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialData?: any | null;
}

export function InvestmentModal({ isOpen, onOpenChange, initialData }: InvestmentModalProps) {
  const [tickerResults, setTickerResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formState, setFormState] = useState({
    type: "COMPRA",
    ticker: "",
    price: "",
    quantity: "",
    commission: "0",
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const p = parseFloat(formState.price);
    const q = parseFloat(formState.quantity);
    if (!isNaN(p) && !isNaN(q)) {
      setFormState(prev => ({ ...prev, commission: (p * q * 0.008).toFixed(2) }));
    }
  }, [formState.price, formState.quantity]);

  useEffect(() => {
  if (initialData) {
    setFormState({
      ticker: initialData.ticker,
      type: initialData.type,
      price: String(initialData.price),
      quantity: String(initialData.quantity),
      commission: String(initialData.commission),
      date: initialData.date,
    });
  } else {
    setFormState({ ticker: "", type: "COMPRA", price: "", quantity: "", commission: "0", date: new Date().toISOString().split('T')[0] });
  }
}, [initialData]);

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
    setErrorMsg(""); // Limpiamos errores anteriores
    
    // 1. Armamos el objeto con los datos del formulario
    const payload = {
      ticker: formState.ticker,
      type: formState.type as "COMPRA" | "VENTA",
      price: Number(formState.price),
      quantity: Number(formState.quantity),
      commission: Number(formState.commission),
      date: formState.date,
    };

    // Le decimos a TypeScript que 'result' puede contener un 'error' opcional
    let result: { success: boolean; error?: string };

    if (initialData && initialData.id) {
      // Usamos "as any" o aserción de tipo para evitar el conflicto con actions.ts
      result = (await updateTransactionData(initialData.id, payload)) as { success: boolean; error?: string };
    } else {
      result = (await addTransaction(payload)) as { success: boolean; error?: string };
    }
    
    // 3. Si la validación del backend falla, mostramos el error y cortamos la ejecución
    if (!result.success) {
      setErrorMsg(result.error || "Error al procesar la operación.");
      return; 
    }

    // 4. Si salió todo bien, actualizamos la data y cerramos
    mutate("portfolio");
    mutate("movements");
    
    onClose();
    
    // 5. Limpiamos el formulario para la próxima vez
    setFormState({
      type: "COMPRA",
      ticker: "",
      price: "",
      quantity: "",
      commission: "0",
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <Modal isOpen={isOpen} isDismissable={false} isKeyboardDismissDisabled={true} onOpenChange={onOpenChange} placement="center" size="xl">
      <ModalContent>
        {(onClose) => (
          <form onSubmit={(e) => handleSubmit(e, onClose)}>
            <ModalHeader className="text-2xl mt-3">{initialData ? "Editar Movimiento" : "Registrar Nueva Compra"}</ModalHeader>
            <ModalBody>
              <RadioGroup
                orientation="horizontal"
                value={formState.type}
                onValueChange={(v) => setFormState({ ...formState, type: v })}
                className="mb-2"
              >
                <Radio value="COMPRA" color="primary">Compra</Radio>
                <Radio value="VENTA" color="danger">Venta</Radio>
              </RadioGroup>
              <Autocomplete
                isRequired
                label="Ticker"
                placeholder="Busca un activo (ej: AAPL, META)"
                isLoading={isSearching}
                items={tickerResults}
                allowsCustomValue
                inputValue={formState.ticker}
                onInputChange={(value) => {
                  setFormState(prev => ({ ...prev, ticker: value }));  // 👈 sincroniza
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
                  isRequired label="Precio unitario en USD CLL" type="number" step="0.01" 
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
              <I18nProvider locale="es-AR">
                <DatePicker 
                  isRequired 
                  label="Fecha"
                  // Si hay fecha, la parseamos al tipo DateValue que espera HeroUI
                  value={formState.date ? parseDate(formState.date.split('T')[0]) : null} 
                  onChange={(v) => {
                    // v es un objeto de tipo CalendarDate
                    // v.toString() lo convierte automáticamente al string "YYYY-MM-DD"
                    if (v) {
                      setFormState({ ...formState, date: v.toString() });
                    } else {
                      setFormState({ ...formState, date: "" }); // O maneja el estado vacío según tu lógica
                    }
                  }} 
                />
              </I18nProvider>

              {/* Mensaje de Error de Validación */}
              {errorMsg && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm font-medium text-center">
                  {errorMsg}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={onClose}>Cancelar</Button>
              <Button color="primary" type="submit">Guardar Movimiento</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}