import type { Job } from "bullmq";
import type { ReplayJobData } from "./replay.types.js";

export const serializeReplayJob = async (job: Job<ReplayJobData>) => ({
  id: job.id,
  name: job.name,
  data: job.data,
  state: await job.getState(),
  attemptsMade: job.attemptsMade,
  attemptsStarted: job.attemptsStarted,
  maxAttempts: job.opts.attempts,
  failedReason: job.failedReason,
  stacktrace: job.stacktrace,
  progress: job.progress,
  result: job.returnvalue,
  createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
  processedAt: job.processedOn
    ? new Date(job.processedOn).toISOString()
    : undefined,
  finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
});
