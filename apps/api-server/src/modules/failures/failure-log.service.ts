import { prisma } from "../../db.js";
import { toOptionalJson, toRequiredJson } from "../../shared/prisma-json.js";

type FailureLogInput = {
  traceId?: string;
  method: string;
  endpoint: string;
  path: string;
  originalUrl: string;
  queryParams: unknown;
  requestHeaders: unknown;
  requestBody: unknown;
  responseStatus: number;
  responseHeaders?: unknown;
  responseBody?: unknown;
  errorMessage?: string;
  errorStack?: string;
  durationMs: number;
};

export const createFailureLog = async (input: FailureLogInput) => {
  await prisma.failureLog.create({
    data: {
      traceId: input.traceId,
      method: input.method,
      endpoint: input.endpoint,
      path: input.path,
      originalUrl: input.originalUrl,
      queryParams: toRequiredJson(input.queryParams),
      requestHeaders: toRequiredJson(input.requestHeaders),
      requestBody: toOptionalJson(input.requestBody),
      responseStatus: input.responseStatus,
      responseHeaders: toOptionalJson(input.responseHeaders),
      responseBody: toOptionalJson(input.responseBody),
      errorMessage: input.errorMessage,
      errorStack: input.errorStack,
      durationMs: input.durationMs,
    },
  });
};
