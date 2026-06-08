import type { NextFunction, Request, Response } from "express";
import { getControlCenterData } from "./control-center.service.js";

export const controlCenterController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.status(200).json({
      ok: true,
      ...(await getControlCenterData()),
    });
  } catch (error) {
    next(error);
  }
};
