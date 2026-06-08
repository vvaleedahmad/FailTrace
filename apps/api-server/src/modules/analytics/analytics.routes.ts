import { Router } from "express";
import { analyticsController } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.get("/", analyticsController);
