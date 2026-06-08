import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "../../config/env.js";
import { replayQueueName } from "./replay.constants.js";
import type { ReplayJobData } from "./replay.types.js";

let replayQueue: Queue<ReplayJobData> | undefined;

export const getRedisConnectionOptions = ({
  failFast = false,
}: {
  failFast?: boolean;
} = {}): ConnectionOptions => ({
  connectTimeout: 5_000,
  enableAutoPipelining: true,
  maxRetriesPerRequest: failFast ? 1 : null,
  url: env.redisUrl,
});

const getDefaultJobOptions = () => ({
  attempts: Math.max(env.replayJobAttempts, 1),
  backoff: {
    delay: Math.max(env.replayJobBackoffMs, 0),
    type: "exponential" as const,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: false,
});

export const getReplayQueue = () => {
  if (!env.replayQueueEnabled) {
    throw new Error("Replay queue is disabled. Set REPLAY_QUEUE_ENABLED=true.");
  }

  replayQueue ??= new Queue<ReplayJobData>(replayQueueName, {
    connection: getRedisConnectionOptions({ failFast: true }),
    defaultJobOptions: getDefaultJobOptions(),
  });

  return replayQueue;
};

export const closeReplayQueue = async () => {
  if (!replayQueue) {
    return;
  }

  await replayQueue.close();
  replayQueue = undefined;
};
