import type { NextFunction, Request, Response } from "express";
import {
  getResponseDurationMs,
  getRouteEndpoint,
} from "../../shared/http.js";
import { getTraceId } from "../../shared/trace.js";
import { createApiLog } from "./logs.service.js";

const getService = (req: Request) =>
  req.get("x-failtrace-service") ?? req.get("x-service-name") ?? "api-server";

export const persistentRequestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.on("finish", () => {
    void createApiLog({
      traceId: getTraceId(res),
      service: getService(req),
      method: req.method,
      endpoint: getRouteEndpoint(req),
      path: req.path,
      originalUrl: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: getResponseDurationMs(res),
      requestId: req.get("x-request-id"),
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    }).catch((error) => {
      console.error("Failed to persist API request log", error);
    });
  });

  next();
};
