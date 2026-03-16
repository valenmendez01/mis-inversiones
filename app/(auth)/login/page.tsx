"use client";

import { useActionState, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { LockIcon, UserIcon } from "lucide-react"; 
import { login } from "@/app/auth-actions";
import { title } from "@/components/primitives";
import Link from "next/link"; // Agregado

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md p-4 shadow-xl border-none bg-background/60 dark:bg-default-50/50 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-1 items-center pb-8">
          <h1 className={title({ size: "sm", color: "blue" })}>Bienvenido</h1>
          <p className="text-default-500 text-small">Ingresa tus credenciales para continuar</p>
        </CardHeader>
        
        <CardBody>
          {/* Usamos formAction en lugar de un handleSubmit manual */}
          <form action={formAction} className="flex flex-col gap-4">
            <Input
              isRequired
              name="username"
              label="Usuario"
              placeholder="Escribe tu usuario"
              variant="bordered"
              labelPlacement="outside"
              startContent={<UserIcon className="text-2xl text-default-400 pointer-events-none" />}
            />
            
            <Input
              isRequired
              name="password"
              label="Contraseña"
              placeholder="********"
              type="password"
              variant="bordered"
              labelPlacement="outside"
              startContent={<LockIcon className="text-2xl text-default-400 pointer-events-none" />}
            />

            {/* Mostramos el error si el estado lo contiene */}
            {state?.error && (
              <div className="bg-danger-50 text-danger text-tiny p-3 rounded-medium border-1 border-danger-200">
                {state.error}
              </div>
            )}

            <Button 
              type="submit" 
              color="primary" 
              className="mt-2 font-semibold"
              size="lg"
              // isPending es true mientras la Server Action se ejecuta en el servidor
              isLoading={isPending}
            >
              {isPending ? "Iniciando..." : "Ingresar"}
            </Button>
          </form>

          <p className="text-center text-small text-default-500 mt-6">
            ¿No tienes un portafolio?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Regístrate aquí
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}