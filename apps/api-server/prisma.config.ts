import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { deriveSupabaseDirectUrl, normalizePostgresUrl } from "./src/config/database-url.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnv({ path: path.resolve(__dirname, ".env") });

const databaseUrl = process.env.DATABASE_URL
  ? normalizePostgresUrl(process.env.DATABASE_URL)
  : undefined;
const directUrl = process.env.DIRECT_URL
  ? normalizePostgresUrl(process.env.DIRECT_URL)
  : deriveSupabaseDirectUrl(databaseUrl);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl ?? databaseUrl,
  },
});
