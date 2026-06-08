import { Router } from "express";
import { requireAdminAuth } from "../auth/auth.middleware.js";
import {
  getReplayJobController,
  getReplayQueueStatusController,
  listReplayJobsController,
  queueReplayFailureController,
  queueReplayFailuresController,
  retryFailedReplayJobsController,
  retryReplayJobController,
} from "./replay-queue.controller.js";
import {
  replayFailureController,
  replayFailuresController,
} from "./replay.controller.js";

export const replayRouter = Router();

replayRouter.use(requireAdminAuth);
replayRouter.get("/queue", getReplayQueueStatusController);
replayRouter.get("/queue/jobs", listReplayJobsController);
replayRouter.post("/queue/retry-failed", retryFailedReplayJobsController);
replayRouter.post("/queue/:jobId/retry", retryReplayJobController);
replayRouter.get("/queue/:jobId", getReplayJobController);
replayRouter.post("/queue", queueReplayFailuresController);
replayRouter.post("/queue/:failureId", queueReplayFailureController);
replayRouter.post("/", replayFailuresController);
replayRouter.post("/:failureId", replayFailureController);
