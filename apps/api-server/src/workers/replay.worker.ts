import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../db.js";
import { getRedisConnectionOptions } from "../queues/replay/replay.client.js";
import {
  replayJobName,
  replayQueueName,
} from "../queues/replay/replay.constants.js";
import type { ReplayJobData } from "../queues/replay/replay.types.js";
import { replayFailure } from "../modules/replay/replay.service.js";

if (!env.replayQueueEnabled) {
  throw new Error("Replay worker requires REPLAY_QUEUE_ENABLED=true.");
}

const workerName = process.env.HOSTNAME ?? `replay-worker-${process.pid}`;

const worker = new Worker<ReplayJobData>(
  replayQueueName,
  async (job) => {
    if (job.name !== replayJobName) {
      throw new Error(`Unsupported replay job: ${job.name}`);
    }

    await job.log(
      `Starting replay attempt ${job.attemptsMade + 1} of ${
        job.opts.attempts ?? 1
      }${job.data.traceId ? ` for trace ${job.data.traceId}` : ""}`,
    );
    await job.updateProgress(10);
    const result = await replayFailure(job.data.failureId, job.data.targetBaseUrl);
    await job.updateProgress(100);
    await job.log(`Replay completed with result ${result.id}`);

    return result;
  },
  {
    concurrency: Math.max(env.replayWorkerConcurrency, 1),
    connection: getRedisConnectionOptions(),
    maxStalledCount: Math.max(env.replayJobMaxStalledCount, 0),
    name: workerName,
    stalledInterval: Math.max(env.replayJobStalledIntervalMs, 1_000),
  },
);

worker.on("completed", (job) => {
  console.log(`Replay job ${job.id} completed for failure ${job.data.failureId}`);
});

worker.on("failed", (job, error) => {
  if (job) {
    void job.log(
      `Replay attempt ${job.attemptsMade} failed: ${error.message}`,
    );
  }

  console.error(
    `Replay job ${job?.id ?? "unknown"} failed after ${
      job?.attemptsMade ?? 0
    } attempt(s): ${error.message}`,
  );
});

worker.on("stalled", (jobId) => {
  console.warn(`Replay job ${jobId} stalled and will be retried by BullMQ`);
});

worker.on("error", (error) => {
  console.error(`Replay worker ${workerName} error: ${error.message}`);
});

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

console.log(
  `Replay worker ${workerName} listening on ${replayQueueName} with concurrency ${Math.max(
    env.replayWorkerConcurrency,
    1,
  )}`,
);
