import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Carga las variables de tu .env
dotenv.config({ path: '.env.local' }); // o solo '.env' dependiendo de qué uses

export default defineConfig({
  schema: './schema-master.ts',
  out: './drizzle', // Aquí se guardarán los historiales de migración
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});