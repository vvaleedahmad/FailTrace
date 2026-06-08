import { prisma } from "../../db.js";
import { toOptionalJson, toRequiredJson } from "../../shared/prisma-json.js";
import { sanitizeSensitiveData } from "../../shared/sanitize.js";

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
  const sanitizedQueryParams = sanitizeSensitiveData(input.queryParams);
  const sanitizedRequestHeaders = sanitizeSensitiveData(input.requestHeaders);
  const sanitizedRequestBody = sanitizeSensitiveData(input.requestBody);
  const sanitizedResponseHeaders = sanitizeSensitiveData(input.responseHeaders);
  const sanitizedResponseBody = sanitizeSensitiveData(input.responseBody);

  await prisma.failureLog.create({
    data: {
      traceId: input.traceId,
      method: input.method,
      endpoint: input.endpoint,
      path: input.path,
      originalUrl: input.originalUrl,
      queryParams: toRequiredJson(sanitizedQueryParams),
      requestHeaders: toRequiredJson(sanitizedRequestHeaders),
      requestBody: toOptionalJson(sanitizedRequestBody),
      responseStatus: input.responseStatus,
      responseHeaders: toOptionalJson(sanitizedResponseHeaders),
      responseBody: toOptionalJson(sanitizedResponseBody),
      errorMessage: input.errorMessage,
      errorStack: input.errorStack,
      durationMs: input.durationMs,
    },
  });
};
