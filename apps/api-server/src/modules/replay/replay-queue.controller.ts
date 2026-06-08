import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import {
  getReplayJob,
  getReplayQueueStatus,
  listReplayJobs,
  queueReplayFailure,
  queueReplayFailures,
  retryFailedReplayJobs,
  retryReplayJob,
  type ReplayJobState,
} from "../../queues/replay.queue.js";
import {
  parseIntegerArray,
  parseOptionalPositiveInteger,
  parseStringArray,
} from "../../shared/query.js";
import { ReplayServiceError } from "./replay.service.js";

const handleReplayError = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ReplayServiceError) {
    res.status(error.statusCode).json({
      ok: false,
      error: error.message,
    });
    return;
  }

  next(error);
};

const parseReplaySelectionBody = (body: unknown) => {
  const input = body && typeof body === "object" ? body : {};

  return {
    endpoint:
      "endpoint" in input && typeof input.endpoint === "string"
        ? input.endpoint
        : undefined,
    failureIds:
      "failureIds" in input ? parseStringArray(input.failureIds) : undefined,
    limit: "limit" in input ? parseOptionalPositiveInteger(input.limit) : undefined,
    statusCodes:
      "statusCodes" in input ? parseIntegerArray(input.statusCodes) : undefined,
    targetBaseUrl:
      "targetBaseUrl" in input && typeof input.targetBaseUrl === "string"
        ? input.targetBaseUrl
        : undefined,
  };
};

const ensureReplayQueueEnabled = (res: Response) => {
  if (env.replayQueueEnabled) {
    return true;
  }

  res.status(503).json({
    ok: false,
    error: "Replay queue is disabled. Set REPLAY_QUEUE_ENABLED=true.",
  });

  return false;
};

const replayJobStates = new Set<ReplayJobState>([
  "active",
  "completed",
  "delayed",
  "failed",
  "waiting",
]);

const parseReplayJobState = (state: unknown): ReplayJobState =>
  typeof state === "string" && replayJobStates.has(state as ReplayJobState)
    ? (state as ReplayJobState)
    : "failed";

export const queueReplayFailureController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const failureId = req.params.failureId;

    if (typeof failureId !== "string") {
      res.status(400).json({
        ok: false,
        error: "failureId is required",
      });
      return;
    }

    const job = await queueReplayFailure(
      failureId,
      typeof req.body?.targetBaseUrl === "string"
        ? req.body.targetBaseUrl
        : undefined,
    );

    res.status(202).json({
      ok: true,
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
      },
    });
  } catch (error) {
    handleReplayError(error, req, res, next);
  }
};

export const queueReplayFailuresController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const jobs = await queueReplayFailures(parseReplaySelectionBody(req.body));

    res.status(202).json({
      ok: true,
      count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
      })),
    });
  } catch (error) {
    handleReplayError(error, req, res, next);
  }
};

export const getReplayJobController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const jobId = req.params.jobId;

    if (typeof jobId !== "string") {
      res.status(400).json({
        ok: false,
        error: "jobId is required",
      });
      return;
    }

    const job = await getReplayJob(jobId);

    if (!job) {
      res.status(404).json({
        ok: false,
        error: "Replay job not found",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      job,
    });
  } catch (error) {
    next(error);
  }
};

export const getReplayQueueStatusController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    res.status(200).json({
      ok: true,
      queue: await getReplayQueueStatus(),
    });
  } catch (error) {
    next(error);
  }
};

export const listReplayJobsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const jobs = await listReplayJobs(
      parseReplayJobState(req.query.state),
      parseOptionalPositiveInteger(req.query.limit) ?? 25,
    );

    res.status(200).json({
      ok: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

export const retryReplayJobController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const jobId = req.params.jobId;

    if (typeof jobId !== "string") {
      res.status(400).json({
        ok: false,
        error: "jobId is required",
      });
      return;
    }

    const job = await retryReplayJob(jobId);

    if (!job) {
      res.status(404).json({
        ok: false,
        error: "Replay job not found",
      });
      return;
    }

    res.status(202).json({
      ok: true,
      job,
    });
  } catch (error) {
    next(error);
  }
};

export const retryFailedReplayJobsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!ensureReplayQueueEnabled(res)) {
      return;
    }

    const limit = parseOptionalPositiveInteger(req.body?.limit) ?? 100;

    await retryFailedReplayJobs(limit);

    res.status(202).json({
      ok: true,
      retryQueued: true,
      limit,
    });
  } catch (error) {
    next(error);
  }
};
