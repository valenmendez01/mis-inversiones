"use client";

import React, { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { mutate } from "swr"; // <-- Importamos mutate de swr

import { searchTickers, addTransaction } from "@/app/actions";

interface InvestmentModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function InvestmentModal({ isOpen, onOpenChange }: InvestmentModalProps) {
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

  useEffect(() => {
    const p = parseFloat(formState.price);
    const q = parseFloat(formState.quantity);
    if (p && q) {
      setFormState(prev => ({ ...prev, commission: (p * q * 0.008).toFixed(2) }));
    }
  }, [formState.price, formState.quantity]);

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
    
    // Le decimos a SWR que revalide las cachés en segundo plano
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
  );
}