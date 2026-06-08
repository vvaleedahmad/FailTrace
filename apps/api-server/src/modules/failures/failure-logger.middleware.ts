import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import { getElapsedMs, getRouteEndpoint } from "../../shared/http.js";
import { getErrorMessageFromBody } from "../../shared/response.js";
import { getTraceId } from "../../shared/trace.js";
import { createFailureLog } from "./failure-log.service.js";
import type { FailureCaptureState } from "./request-timer.middleware.js";

const getCaptureState = (res: Response): FailureCaptureState => {
  if (!res.locals.failureCapture) {
    res.locals.failureCapture = {
      startedAt: process.hrtime.bigint(),
    } satisfies FailureCaptureState;
  }

  return res.locals.failureCapture as FailureCaptureState;
};

const logFailure = async (req: Request, res: Response, error?: unknown) => {
  const state = getCaptureState(res);

  // A failed request can hit both the response-finish path and the error path.
  if (state.logged) {
    return;
  }

  state.logged = true;

  const errorMessage =
    error instanceof Error
      ? error.message
      : getErrorMessageFromBody(state.responseBody);

  try {
    await createFailureLog({
      traceId: getTraceId(res),
      method: req.method,
      endpoint: getRouteEndpoint(req),
      path: req.path,
      originalUrl: req.originalUrl,
      queryParams: req.query,
      requestHeaders: req.headers,
      requestBody: req.body,
      responseStatus: res.statusCode,
      responseHeaders: res.getHeaders(),
      responseBody: state.responseBody,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      durationMs: getElapsedMs(state.startedAt),
    });
  } catch (loggingError) {
    console.error("Failed to persist API failure log", loggingError);
  }
};

const shouldSkipFailureCapture = (req: Request) =>
  req.get("x-failtrace-replay") === "true";

export const failedResponseLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.on("finish", () => {
    if (!shouldSkipFailureCapture(req) && res.statusCode >= 400) {
      void logFailure(req, res);
    }
  });

  next();
};

export const errorFailureLoggerMiddleware: ErrorRequestHandler = async (
  error,
  req,
  res,
  next,
) => {
  if (shouldSkipFailureCapture(req)) {
    next(error);
    return;
  }

  if (res.statusCode < 400) {
    res.status(500);
  }

  await logFailure(req, res, error);
  next(error);
};
