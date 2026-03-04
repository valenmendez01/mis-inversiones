import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as masterSchema from '../schema-master'; 
import * as tenantSchema from '../schema-tenant';

// 1. Conexión a la base MASTER (usa las variables de entorno de tu proyecto)
const masterClient = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
export const masterDb = drizzle(masterClient, { schema: masterSchema });

// 2. Conexión dinámica al TENANT
export function connectTenant(dbUrl: string, authToken: string) {
  const client = createClient({
    url: dbUrl,
    authToken: authToken,
  });
  
  return drizzle(client, { schema: tenantSchema });
}