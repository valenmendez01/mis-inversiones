"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner"; // Importamos el Spinner de HeroUI
import { LockIcon, UserIcon } from "lucide-react"; 
import { register } from "@/app/auth-actions";
import { title } from "@/components/primitives";
import Link from "next/link";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await register(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado al aprovisionar tu cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md p-4 shadow-xl border-none bg-background/60 dark:bg-default-50/50 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-1 items-center pb-8">
          <h1 className={title({ size: "sm", color: "blue" })}>Crear Cuenta</h1>
          <p className="text-default-500 text-small text-center">
            Aprovisionaremos una base de datos privada para tu portafolio
          </p>
        </CardHeader>
        
        <CardBody>
          {loading ? (
            /* Vista de carga con el Spinner centrado */
            <div className="flex flex-col items-center justify-center py-10 gap-6">
              <Spinner size="lg" color="primary" label="Creando base de datos..." />
              <p className="text-default-500 text-sm text-center px-4">
                Por favor no cierres esta ventana, estamos configurando tu entorno seguro. Esto puede tardar unos segundos.
              </p>
            </div>
          ) : (
            /* Formulario normal cuando no está cargando */
            <>
              <form action={handleSubmit} className="flex flex-col gap-4">
                <Input
                  isRequired
                  name="username"
                  label="Usuario"
                  placeholder="Elige un nombre de usuario"
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
                  size="lg"
                >
                  Registrarse y crear BD
                </Button>
              </form>

              {/* Enlace al login */}
              <p className="text-center text-small text-default-500 mt-6">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Inicia sesión aquí
                </Link>
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}