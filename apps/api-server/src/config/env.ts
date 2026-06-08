import path from "node:path";
import { config as loadEnv } from "dotenv";
import { deriveSupabaseDirectUrl, normalizePostgresUrl } from "./database-url.js";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

const required = ["DATABASE_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  replayBaseUrl:
    process.env.REPLAY_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4000}`,
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  replayQueueEnabled: process.env.REPLAY_QUEUE_ENABLED === "true",
  replayWorkerConcurrency: Number(process.env.REPLAY_WORKER_CONCURRENCY ?? 5),
  replaySyncConcurrency: Number(process.env.REPLAY_SYNC_CONCURRENCY ?? 5),
  replayJobAttempts: Number(process.env.REPLAY_JOB_ATTEMPTS ?? 3),
  replayJobBackoffMs: Number(process.env.REPLAY_JOB_BACKOFF_MS ?? 5_000),
  replayJobMaxStalledCount: Number(process.env.REPLAY_JOB_MAX_STALLED_COUNT ?? 3),
  replayJobStalledIntervalMs: Number(
    process.env.REPLAY_JOB_STALLED_INTERVAL_MS ?? 30_000,
  ),
  jwtSecret: process.env.JWT_SECRET ?? "failtrace-development-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  databaseUrl: normalizePostgresUrl(process.env.DATABASE_URL!),
  directUrl: process.env.DIRECT_URL
    ? normalizePostgresUrl(process.env.DIRECT_URL)
    : deriveSupabaseDirectUrl(process.env.DATABASE_URL),
};
