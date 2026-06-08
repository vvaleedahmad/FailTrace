import { Router } from "express";
import { adminLoginController } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", adminLoginController);
