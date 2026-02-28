"use client";

import React, { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
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
  
  const [formState, setFormState] = useState({
    ticker: "",
    price: "",
    quantity: "",
    commission: "0",
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const p = parseFloat(formState.price);
    const q = parseFloat(formState.quantity);
    if (p && q) {
      setFormState(prev => ({ ...prev, commission: (p * q * 0.008).toFixed(2) }));
    }
  }, [formState.price, formState.quantity]);

  useEffect(() => {
  if (initialData) {
    setFormState({
      ticker: initialData.ticker,
      price: String(initialData.price),
      quantity: String(initialData.quantity),
      commission: String(initialData.commission),
      date: initialData.date,
    });
  } else {
    setFormState({ ticker: "", price: "", quantity: "", commission: "0", date: new Date().toISOString().split('T')[0] });
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

    const transactionPayload = {
      ticker: formState.ticker,
      price: Number(formState.price),
      quantity: Number(formState.quantity),
      commission: Number(formState.commission),
      date: formState.date,
    };

    if (initialData?.id) {
      await updateTransactionData(initialData.id, transactionPayload);
    } else {
      await addTransaction(transactionPayload);
    }
    
    mutate("portfolio");
    mutate("movements");
    
    onClose();
    setFormState({
      ticker: "",
      price: "",
      quantity: "",
      commission: "0",
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
      <ModalContent>
        {(onClose) => (
          <form onSubmit={(e) => handleSubmit(e, onClose)}>
            <ModalHeader>{initialData ? "Editar Movimiento" : "Registrar Nueva Compra"}</ModalHeader>
            <ModalBody>
              <Autocomplete
                isRequired
                label="Ticker"
                placeholder="Busca un activo (ej: AAPL, ALUA.BA)"
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
  );
}