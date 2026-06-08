import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const traceHeaderName = "x-failtrace-trace-id";

export const getTraceId = (res: Response) =>
  typeof res.locals.traceId === "string" ? res.locals.traceId : undefined;

const getIncomingTraceId = (req: Request) =>
  req.get(traceHeaderName) ?? req.get("x-request-id");

export const traceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const traceId = getIncomingTraceId(req) ?? randomUUID();

  res.locals.traceId = traceId;
  res.setHeader(traceHeaderName, traceId);

  next();
};
