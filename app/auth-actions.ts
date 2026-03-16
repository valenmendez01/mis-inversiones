
"use server";

import bcrypt from "bcryptjs";
import { masterDb, connectTenant } from "../app/db";
import { users } from "../schema-master";
import { eq, sql } from "drizzle-orm";
import { createSession } from "../app/lib/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export async function login(prevState: any, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const user = await masterDb
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Usuario o contraseña incorrectos" };
  }

  await createSession(user.id);
  // redirect() lanzará el error de redirección que Next.js manejará automáticamente
  redirect("/");
}

export async function logout() {
  (await cookies()).set("session", "", { expires: new Date(0) });
  redirect("/login");
}

export async function register(prevState: any, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  // 1. Verificar si el usuario ya existe en la Master DB
  const existingUser = await masterDb.select().from(users).where(eq(users.username, username)).get();
  if (existingUser) {
    return { error: "El nombre de usuario ya está en uso." };
  }

  const orgName = process.env.TURSO_ORG_NAME;
  const apiToken = process.env.TURSO_API_TOKEN;
  
  // Generamos un nombre único para la base de datos del cliente
  const dbName = `tenant-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;

  try {
    // 2. Crear la base de datos en Turso vía API REST
    const createDbRes = await fetch(`https://api.turso.tech/v1/organizations/${orgName}/databases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: dbName,
        group: "inversiones" // Usa el grupo que tengas por defecto en Turso
      })
    });

    if (!createDbRes.ok) throw new Error("Fallo al crear la base de datos en Turso");
    const dbData = await createDbRes.json();
    
    // Turso puede devolver un hostname genérico. Lo armamos si es necesario.
    const dbUrl = `libsql://${dbData.database.Hostname}`;

    // 3. Crear un Token de acceso permanente para esta base de datos
    const createTokenRes = await fetch(`https://api.turso.tech/v1/organizations/${orgName}/databases/${dbName}/auth/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!createTokenRes.ok) throw new Error("Fallo al generar el token de la base de datos");
    const tokenData = await createTokenRes.json();
    const dbToken = tokenData.jwt;

    // 4. Conectarnos a la nueva base de datos y crear las tablas (Migración Inicial)
    // Le damos un pequeño delay (opcional) de 1-2 segundos para asegurar que el DNS de Turso replicó la BD
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const tenantDb = connectTenant(dbUrl, dbToken);

    await tenantDb.run(sql`
      CREATE TABLE IF NOT EXISTS assets (
        ticker TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sector TEXT,
        location TEXT,
        updated_at INTEGER
      );
    `);

    await tenantDb.run(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL REFERENCES assets(ticker),
        type TEXT NOT NULL DEFAULT 'COMPRA',
        price REAL NOT NULL,
        quantity REAL NOT NULL,
        date TEXT NOT NULL,
        commission REAL NOT NULL
      );
    `);

    // 5. Guardar el usuario y sus credenciales de base de datos en la Master DB
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await masterDb.insert(users).values({
      id: userId,
      username,
      password: hashedPassword,
      dbUrl: dbUrl,
      dbToken: dbToken
    });

    // 6. Iniciar sesión automáticamente
    await createSession(userId);
    
  } catch (error) {
    console.error("Error aprovisionando tenant:", error);
    return { error: "Ocurrió un error al configurar tu cuenta. Intenta nuevamente." };
  }

  redirect("/");
}