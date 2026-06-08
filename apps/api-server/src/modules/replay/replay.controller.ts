import type { NextFunction, Request, Response } from "express";
import {
  parseIntegerArray,
  parseOptionalPositiveInteger,
  parseStringArray,
} from "../../shared/query.js";
import {
  replayFailure,
  replayFailures,
  ReplayServiceError,
} from "./replay.service.js";

const handleReplayError = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ReplayServiceError) {
    res.status(error.statusCode).json({
      ok: false,
      error: error.message,
    });
    return;
  }

  next(error);
};

export const replayFailureController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const failureId = req.params.failureId;

    if (typeof failureId !== "string") {
      res.status(400).json({
        ok: false,
        error: "failureId is required",
      });
      return;
    }

    const result = await replayFailure(
      failureId,
      typeof req.body?.targetBaseUrl === "string"
        ? req.body.targetBaseUrl
        : undefined,
    );

    res.status(201).json({
      ok: true,
      result,
    });
  } catch (error) {
    handleReplayError(error, req, res, next);
  }
};

export const replayFailuresController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const output = await replayFailures({
      endpoint:
        typeof req.body?.endpoint === "string" ? req.body.endpoint : undefined,
      failureIds: parseStringArray(req.body?.failureIds),
      limit: parseOptionalPositiveInteger(req.body?.limit),
      statusCodes: parseIntegerArray(req.body?.statusCodes),
      targetBaseUrl:
        typeof req.body?.targetBaseUrl === "string"
          ? req.body.targetBaseUrl
          : undefined,
    });

    res.status(201).json({
      ok: true,
      ...output,
    });
  } catch (error) {
    handleReplayError(error, req, res, next);
  }
};
