import cors from "cors";
import express from "express";
import { prisma } from "./db.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  errorFailureLoggerMiddleware,
  failedResponseLoggerMiddleware,
} from "./modules/failures/failure-logger.middleware.js";
import { requestTimerMiddleware } from "./modules/failures/request-timer.middleware.js";
import { responseCaptureMiddleware } from "./modules/failures/response-capture.middleware.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { controlCenterRouter } from "./modules/control-center/control-center.routes.js";
import { persistentRequestLoggerMiddleware } from "./modules/logs/logs.middleware.js";
import { logsRouter } from "./modules/logs/logs.routes.js";
import { replayRouter } from "./modules/replay/replay.routes.js";
import { traceMiddleware } from "./shared/trace.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(traceMiddleware);

// These run before routes so later middleware can reuse the same timing/body data.
app.use(requestTimerMiddleware);
app.use(responseCaptureMiddleware);
app.use(persistentRequestLoggerMiddleware);
app.use(failedResponseLoggerMiddleware);

app.get("/health", async (_req, res, next) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");

    res.status(200).json({
      ok: true,
      database: "connected",
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/control-center", controlCenterRouter);
app.use("/api/replays", replayRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/logs", logsRouter);

// Error handlers stay last so route errors pass through the failure logger first.
app.use(errorFailureLoggerMiddleware);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "Unexpected error";

    res.status(500).json({
      ok: false,
      error: message,
    });
  },
);
