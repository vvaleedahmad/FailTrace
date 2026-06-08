import type { NextFunction, Request, Response } from "express";

export type FailureCaptureState = {
  startedAt: bigint;
  responseBody?: unknown;
  logged?: boolean;
};

export const requestTimerMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.locals.failureCapture = {
    startedAt: process.hrtime.bigint(),
  } satisfies FailureCaptureState;

  next();
};
