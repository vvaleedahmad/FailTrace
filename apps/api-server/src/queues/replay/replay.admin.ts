import { Job } from "bullmq";
import { env } from "../../config/env.js";
import { replayQueueName } from "./replay.constants.js";
import { getReplayQueue } from "./replay.client.js";
import { serializeReplayJob } from "./replay.serializer.js";
import type { ReplayJobData, ReplayJobState } from "./replay.types.js";

export const getReplayJob = async (jobId: string) => {
  const job = await Job.fromId<ReplayJobData>(getReplayQueue(), jobId);

  if (!job) {
    return undefined;
  }

  return serializeReplayJob(job);
};

export const getReplayQueueStatus = async () => {
  const queue = getReplayQueue();
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "completed",
    "failed",
    "paused",
  );

  return {
    name: replayQueueName,
    counts,
    retry: {
      attempts: Math.max(env.replayJobAttempts, 1),
      backoffMs: Math.max(env.replayJobBackoffMs, 0),
      backoffType: "exponential",
    },
    retention: {
      failedJobs: "kept-until-explicitly-removed",
      completedJobs: "kept-for-24-hours-or-1000-jobs",
    },
  };
};

export const listReplayJobs = async (
  state: ReplayJobState = "failed",
  limit = 25,
) => {
  const end = Math.min(Math.max(limit, 1), 100) - 1;
  const jobs = await getReplayQueue().getJobs(state, 0, end, false);

  return Promise.all(
    jobs.map((job) => serializeReplayJob(job as Job<ReplayJobData>)),
  );
};

export const retryReplayJob = async (jobId: string) => {
  const job = await Job.fromId<ReplayJobData>(getReplayQueue(), jobId);

  if (!job) {
    return undefined;
  }

  await job.retry("failed");

  return serializeReplayJob(job);
};

export const retryFailedReplayJobs = async (limit = 100) => {
  await getReplayQueue().retryJobs({
    count: Math.min(Math.max(limit, 1), 1_000),
    state: "failed",
  });
};
