import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";
import { env } from "../../config/env.js";
import { prisma } from "../../db.js";
import { Prisma } from "../../generated/prisma/client.js";
import { runWithConcurrency } from "../../shared/concurrency.js";
import { isRecord } from "../../shared/object.js";
import { toOptionalJson } from "../../shared/prisma-json.js";
import { getErrorMessageFromBody } from "../../shared/response.js";
import { normalizeForComparison } from "../../shared/stable-json.js";

type ReplaySelection = {
  failureIds?: string[];
  statusCodes?: number[];
  endpoint?: string;
  limit?: number;
  targetBaseUrl?: string;
};

type ReplayFailureRef = {
  id: string;
  traceId: string | null;
};

type FailureLogRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.failureLog.findUnique>>
>;

type ReplayedResponse = {
  status?: number;
  headers?: unknown;
  body?: unknown;
  errorMessage?: string;
  durationMs: number;
};

export class ReplayServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const excludedReplayHeaders = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "accept-encoding",
]);

const normalizeBaseUrl = (baseUrl: string) => {
  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = parsed.pathname.endsWith("/")
      ? parsed.pathname
      : `${parsed.pathname}/`;

    return parsed.toString();
  } catch {
    throw new ReplayServiceError("Invalid targetBaseUrl", 400);
  }
};

const buildReplayUrl = (originalUrl: string, targetBaseUrl: string) =>
  new URL(originalUrl, normalizeBaseUrl(targetBaseUrl)).toString();

const buildReplayHeaders = (headers: unknown) => {
  if (!isRecord(headers)) {
    return {};
  }

  return Object.entries(headers).reduce<Record<string, string>>(
    (replayHeaders, [key, value]) => {
      if (excludedReplayHeaders.has(key.toLowerCase()) || value == null) {
        return replayHeaders;
      }

      replayHeaders[key] = Array.isArray(value)
        ? value.map(String).join(", ")
        : String(value);

      return replayHeaders;
    },
    {},
  );
};

const methodAllowsBody = (method: string) =>
  !["GET", "HEAD"].includes(method.toUpperCase());

const buildReplayRequest = (
  failureLog: FailureLogRecord,
  replayUrl: string,
): AxiosRequestConfig => ({
  data: methodAllowsBody(failureLog.method) ? failureLog.requestBody : undefined,
  headers: {
    ...buildReplayHeaders(failureLog.requestHeaders),
    "x-failtrace-replay": "true",
    "x-failtrace-service": "replay-engine",
    ...(failureLog.traceId
      ? { "x-failtrace-trace-id": failureLog.traceId }
      : {}),
  },
  method: failureLog.method as Method,
  timeout: 30_000,
  url: replayUrl,
  validateStatus: () => true,
});

const getReplayDurationMs = (startedAt: bigint) =>
  Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));

const replayRequest = async (
  failureLog: FailureLogRecord,
  replayUrl: string,
): Promise<ReplayedResponse> => {
  const startedAt = process.hrtime.bigint();

  try {
    const response = await axios.request(buildReplayRequest(failureLog, replayUrl));
    const errorMessage =
      response.status >= 400
        ? getErrorMessageFromBody(response.data, response.statusText)
        : undefined;

    return {
      status: response.status,
      headers: response.headers,
      body: response.data,
      errorMessage,
      durationMs: getReplayDurationMs(startedAt),
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      status: axiosError.response?.status,
      headers: axiosError.response?.headers,
      body: axiosError.response?.data,
      errorMessage: axiosError.message,
      durationMs: getReplayDurationMs(startedAt),
    };
  }
};

const compareReplayWithOriginal = (
  failureLog: FailureLogRecord,
  replayedResponse: ReplayedResponse,
) => ({
  matchedStatus: replayedResponse.status === failureLog.responseStatus,
  matchedBody:
    normalizeForComparison(replayedResponse.body) ===
    normalizeForComparison(failureLog.responseBody),
  matchedErrorMessage:
    (replayedResponse.errorMessage ?? null) === (failureLog.errorMessage ?? null),
});

const saveReplayResult = async (
  failureLog: FailureLogRecord,
  replayUrl: string,
  replayedResponse: ReplayedResponse,
) => {
  const comparison = compareReplayWithOriginal(failureLog, replayedResponse);

  return prisma.replayResult.create({
    data: {
      traceId: failureLog.traceId,
      failureLogId: failureLog.id,
      replayUrl,
      replayStatus: replayedResponse.status,
      replayResponseHeaders:
        replayedResponse.headers === undefined
          ? undefined
          : toOptionalJson(replayedResponse.headers),
      replayResponseBody:
        replayedResponse.body === undefined
          ? undefined
          : toOptionalJson(replayedResponse.body),
      replayErrorMessage: replayedResponse.errorMessage,
      matchedStatus: comparison.matchedStatus,
      matchedBody: comparison.matchedBody,
      matchedErrorMessage: comparison.matchedErrorMessage,
      durationMs: replayedResponse.durationMs,
    },
  });
};

const replayFailureLog = async (
  failureLog: FailureLogRecord,
  targetBaseUrl: string,
) => {
  const replayUrl = buildReplayUrl(failureLog.originalUrl, targetBaseUrl);
  const replayedResponse = await replayRequest(failureLog, replayUrl);

  return saveReplayResult(failureLog, replayUrl, replayedResponse);
};

export const replayFailure = async (
  failureId: string,
  targetBaseUrl = env.replayBaseUrl,
) => {
  const failureLog = await prisma.failureLog.findUnique({
    where: { id: failureId },
  });

  if (!failureLog) {
    throw new ReplayServiceError("Failure log not found", 404);
  }

  return replayFailureLog(failureLog, targetBaseUrl);
};

const buildFailureSelectionWhere = (selection: ReplaySelection = {}) =>
  ({
    ...(selection.failureIds?.length
      ? { id: { in: selection.failureIds } }
      : {}),
    ...(selection.statusCodes?.length
      ? { responseStatus: { in: selection.statusCodes } }
      : {}),
    ...(selection.endpoint ? { endpoint: { contains: selection.endpoint } } : {}),
  }) satisfies Prisma.FailureLogWhereInput;

export const selectFailureLogsForReplay = async (
  selection: ReplaySelection = {},
) =>
  prisma.failureLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(selection.limit ?? 25, 1), 100),
    where: buildFailureSelectionWhere(selection),
  });

export const selectFailureRefForReplay = async (
  failureId: string,
): Promise<ReplayFailureRef | null> =>
  prisma.failureLog.findUnique({
    select: {
      id: true,
      traceId: true,
    },
    where: { id: failureId },
  });

export const selectFailureRefsForReplay = async (
  selection: ReplaySelection = {},
): Promise<ReplayFailureRef[]> =>
  prisma.failureLog.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      traceId: true,
    },
    take: Math.min(Math.max(selection.limit ?? 25, 1), 100),
    where: buildFailureSelectionWhere(selection),
  });

export const replayFailures = async (selection: ReplaySelection = {}) => {
  const failures = await selectFailureLogsForReplay(selection);
  const targetBaseUrl = selection.targetBaseUrl ?? env.replayBaseUrl;
  const results = await runWithConcurrency(
    failures,
    env.replaySyncConcurrency,
    (failureLog) => replayFailureLog(failureLog, targetBaseUrl),
  );

  return {
    count: results.length,
    results,
  };
};
