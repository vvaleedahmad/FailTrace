import { Router } from "express";
import { listApiLogsController } from "./logs.controller.js";

export const logsRouter = Router();

logsRouter.get("/", listApiLogsController);
