import type { NextFunction, Request, Response } from "express";

export const responseCaptureMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body: unknown) => {
    res.locals.failureCapture.responseBody = body;
    return originalJson(body);
  }) as Response["json"];

  res.send = ((body: unknown) => {
    res.locals.failureCapture.responseBody = body;
    return originalSend(body);
  }) as Response["send"];

  next();
};
