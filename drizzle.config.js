import { defineConfig } from 'drizzle-kit';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
export default defineConfig({ dialect: 'postgresql', schema: './db/schema.js', out: './db/migrations', dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED || '' } });
