"use server";

import { db } from "./db"; // Ajusta la ruta si es necesario
import { cedears, type InsertCedear } from "../schema"; // Ajusta la ruta a tu schema.ts
import { desc, eq } from "drizzle-orm";

// Obtener todos los registros ordenados por id descendente
export async function getCedearsData() {
  return await db.select().from(cedears).orderBy(desc(cedears.id));
}

// Insertar un nuevo registro
export async function addCedearData(data: InsertCedear) {
  await db.insert(cedears).values(data);
  return { success: true };
}

// Eliminar un registro
export async function deleteCedearData(id: number) {
  await db.delete(cedears).where(eq(cedears.id, id));
  return { success: true };
}

// Actualizar un registro
export async function updateCedearData(id: number, data: Partial<InsertCedear>) {
  await db.update(cedears).set(data).where(eq(cedears.id, id));
  return { success: true };
}