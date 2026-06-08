import type { Request, Response } from "express";

type RequestTimingState = {
  startedAt: bigint;
};

export const getRouteEndpoint = (req: Request) => {
  const routePath = req.route?.path;

  if (typeof routePath === "string") {
    return `${req.baseUrl}${routePath}`;
  }

  return req.originalUrl;
};

export const getFailureCaptureState = (
  res: Response,
): RequestTimingState | undefined =>
  res.locals.failureCapture as RequestTimingState | undefined;

export const getElapsedMs = (startedAt: bigint) =>
  Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));

export const getResponseDurationMs = (res: Response) => {
  const state = getFailureCaptureState(res);

  return state ? getElapsedMs(state.startedAt) : 0;
};
