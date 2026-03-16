"use client";

import { useActionState, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { LockIcon, UserIcon } from "lucide-react"; 
import { register } from "@/app/auth-actions";
import { title } from "@/components/primitives";
import Link from "next/link";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md p-4 shadow-xl border-none bg-background/60 dark:bg-default-50/50 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-1 items-center pb-8">
          <h1 className={title({ size: "sm", color: "blue" })}>Crea tu cuenta</h1>
          <p className="text-default-500 text-small">Comienza a gestionar tu portafolio hoy</p>
        </CardHeader>
        
        <CardBody>
          {/* Vinculamos el formulario a formAction */}
          <form action={formAction} className="flex flex-col gap-4">
            <Input
              isRequired
              name="username"
              label="Usuario"
              placeholder="Elige un nombre de usuario"
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

            {/* Mostrar errores devueltos por la Server Action */}
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
              // El spinner se activa automáticamente con isPending
              isLoading={isPending}
            >
              {isPending ? "Creando base de datos..." : "Registrarse"}
            </Button>
          </form>

          <p className="text-center text-small text-default-500 mt-6">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}