
"use server";

import bcrypt from "bcryptjs";
import { db } from "../app/db";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import { createSession } from "../app/lib/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function login(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  // 1. Buscar el usuario en la tabla 'users' de Turso
  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  // 2. Comparar la contraseña ingresada con el hash de la base de datos
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Usuario o contraseña incorrectos" };
  }

  // 3. Crear sesión y redirigir
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  (await cookies()).set("session", "", { expires: new Date(0) });
  redirect("/login");
}