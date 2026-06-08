import { Router } from "express";
import { controlCenterController } from "./control-center.controller.js";

export const controlCenterRouter = Router();

controlCenterRouter.get("/", controlCenterController);
