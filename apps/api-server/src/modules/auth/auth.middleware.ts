import type { NextFunction, Request, Response } from "express";
import { AuthServiceError, verifyAdminToken } from "./auth.service.js";

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return undefined;
  }

  return token;
};

export const requireAdminAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = getBearerToken(req.get("authorization"));

    if (!token) {
      throw new AuthServiceError("Authorization token is required", 401);
    }

    verifyAdminToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthServiceError) {
      res.status(error.statusCode).json({
        ok: false,
        error: error.message,
      });
      return;
    }

    next(error);
  }
};
