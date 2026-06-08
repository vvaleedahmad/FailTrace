import type { NextFunction, Request, Response } from "express";
import { AuthServiceError, loginAdmin } from "./auth.service.js";

const handleAuthError = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof AuthServiceError) {
    res.status(error.statusCode).json({
      ok: false,
      error: error.message,
    });
    return;
  }

  next(error);
};

export const adminLoginController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({
        ok: false,
        error: "email and password are required",
      });
      return;
    }

    const output = await loginAdmin(email, password);

    res.status(200).json({
      ok: true,
      ...output,
    });
  } catch (error) {
    handleAuthError(error, req, res, next);
  }
};
