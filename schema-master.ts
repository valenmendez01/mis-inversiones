import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  dbUrl: text('db_url'),
  dbToken: text('db_token'),
});