import type { NextFunction, Request, Response } from "express";
import {
  getResponseDurationMs,
  getRouteEndpoint,
} from "../../shared/http.js";
import { getTraceId } from "../../shared/trace.js";
import type { FailureCaptureState } from "../failures/request-timer.middleware.js";
import { createApiLog } from "./logs.service.js";

const getService = (req: Request) =>
  req.get("x-failtrace-service") ?? req.get("x-service-name") ?? "api-server";

const getCaptureState = (res: Response) =>
  res.locals.failureCapture as FailureCaptureState | undefined;

export const persistentRequestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.on("finish", () => {
    const traceId = getTraceId(res);
    const responseHeaders = res.getHeaders();
    const responseContentLength = responseHeaders["content-length"];

    void createApiLog({
      traceId,
      service: getService(req),
      method: req.method,
      endpoint: getRouteEndpoint(req),
      path: req.path,
      originalUrl: req.originalUrl,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      durationMs: getResponseDurationMs(res),
      requestId: req.get("x-request-id") ?? traceId,
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
      host: req.get("host"),
      protocol: req.protocol,
      httpVersion: req.httpVersion,
      queryParams: req.query,
      routeParams: req.params,
      requestHeaders: req.headers,
      requestBody: req.body,
      responseHeaders,
      responseBody: getCaptureState(res)?.responseBody,
      responseContentLength: responseContentLength === undefined
        ? undefined
        : String(responseContentLength),
    }).catch((error) => {
      console.error("Failed to persist API request log", error);
    });
  });

  next();
};
