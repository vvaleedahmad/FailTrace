import type { NextFunction, Request, Response } from "express";
import { parseDateRange, parsePositiveInteger } from "../../shared/query.js";
import { getAnalytics } from "./analytics.service.js";

const MAX_ENDPOINTS = 100;
const DEFAULT_ENDPOINT_LIMIT = 10;
const DEFAULT_BUCKET_MINUTES = 60;

const getQueryString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const analyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { from, to } = parseDateRange(req.query);

    const output = await getAnalytics({
      bucketMinutes: parsePositiveInteger(
        req.query.bucketMinutes,
        DEFAULT_BUCKET_MINUTES,
      ),
      endpointLimit: Math.min(
        parsePositiveInteger(req.query.endpointLimit, DEFAULT_ENDPOINT_LIMIT),
        MAX_ENDPOINTS,
      ),
      from,
      traceId: getQueryString(req.query.traceId),
      to,
    });

    res.status(200).json({
      ok: true,
      ...output,
    });
  } catch (error) {
    next(error);
  }
};
