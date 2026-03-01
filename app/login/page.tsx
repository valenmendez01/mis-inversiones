
"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { login } from "@/app/auth-actions";

export default function LoginPage() {
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    const result = await login(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Inversiones</h1>
          <p className="text-default-500">Acceso exclusivo</p>
        </CardHeader>
        <CardBody>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <Input isRequired label="Usuario" name="username" variant="bordered" />
            <Input isRequired label="Contraseña" name="password" type="password" variant="bordered" />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button color="primary" type="submit">Entrar</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}