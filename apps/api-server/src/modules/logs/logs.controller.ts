import type { NextFunction, Request, Response } from "express";
import {
  parseDateRange,
  parseInteger,
  parseNonNegativeInteger,
} from "../../shared/query.js";
import { listApiLogs } from "./logs.service.js";

const getQueryString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const listApiLogsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { from, to } = parseDateRange(req.query);

    const output = await listApiLogs({
      traceId: getQueryString(req.query.traceId),
      endpoint: getQueryString(req.query.endpoint),
      service: getQueryString(req.query.service),
      statusCode: parseInteger(req.query.statusCode),
      from,
      to,
      limit: Math.min(parseNonNegativeInteger(req.query.limit, 50), 200),
      offset: parseNonNegativeInteger(req.query.offset, 0),
    });

    res.status(200).json({
      ok: true,
      ...output,
    });
  } catch (error) {
    next(error);
  }
};
