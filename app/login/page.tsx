"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { LockIcon, UserIcon } from "lucide-react"; // Asegúrate de tener lucide-react instalado
import { login } from "@/app/auth-actions";
import { title } from "@/components/primitives";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md p-4 shadow-xl border-none bg-background/60 dark:bg-default-50/50 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-1 items-center pb-8">
          <h1 className={title({ size: "sm", color: "blue" })}>Bienvenido</h1>
          <p className="text-default-500 text-small">Ingresa tus credenciales para continuar</p>
        </CardHeader>
        
        <CardBody>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <Input
              isRequired
              name="username"
              label="Usuario"
              placeholder="Escribe tu usuario"
              variant="bordered"
              labelPlacement="outside"
              startContent={
                <UserIcon className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
              }
            />
            
            <Input
              isRequired
              name="password"
              label="Contraseña"
              placeholder="********"
              type="password"
              variant="bordered"
              labelPlacement="outside"
              startContent={
                <LockIcon className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
              }
            />

            {error && (
              <div className="bg-danger-50 text-danger text-tiny p-3 rounded-medium border-1 border-danger-200">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              color="primary" 
              className="mt-2 font-semibold"
              isLoading={loading}
              size="lg"
            >
              {loading ? "Iniciando sesión..." : "Ingresar"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}