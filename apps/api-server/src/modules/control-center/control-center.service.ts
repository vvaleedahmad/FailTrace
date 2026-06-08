import { env } from "../../config/env.js";
import { prisma } from "../../db.js";
import { average, percentile, roundTo } from "../../shared/stats.js";

const REQUEST_LIMIT = 100;
const NODE_LIMIT = 50;

type ApiLogRecord = Awaited<ReturnType<typeof getRecentApiLogs>>[number];
type FailureRecord = Awaited<ReturnType<typeof getRecentFailures>>[number];

const getRecentApiLogs = () =>
  prisma.apiLog.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      durationMs: true,
      endpoint: true,
      id: true,
      method: true,
      originalUrl: true,
      path: true,
      service: true,
      statusCode: true,
      traceId: true,
    },
    take: REQUEST_LIMIT,
  });

const getRecentFailures = () =>
  prisma.failureLog.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      durationMs: true,
      endpoint: true,
      errorMessage: true,
      id: true,
      method: true,
      originalUrl: true,
      path: true,
      replayResults: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          durationMs: true,
          id: true,
          matchedBody: true,
          matchedErrorMessage: true,
          matchedStatus: true,
          replayErrorMessage: true,
          replayStatus: true,
          replayUrl: true,
        },
        take: 3,
      },
      responseStatus: true,
      traceId: true,
    },
    take: REQUEST_LIMIT,
  });

const buildFailureKey = (failure: FailureRecord) =>
  `${failure.traceId ?? ""}|${failure.method}|${failure.endpoint}|${failure.responseStatus}`;

const buildApiKey = (log: ApiLogRecord) =>
  `${log.traceId ?? ""}|${log.method}|${log.endpoint}|${log.statusCode}`;

const requestTime = (createdAt: Date) => createdAt.toISOString();

const mapApiRequest = (
  log: ApiLogRecord,
  failuresByKey: Map<string, FailureRecord>,
) => {
  const matchingFailure = failuresByKey.get(buildApiKey(log));

  return {
    id: log.id,
    type: matchingFailure ? "failure" : "api",
    source: "apiLog",
    traceId: log.traceId,
    failureId: matchingFailure?.id ?? null,
    method: log.method,
    endpoint: log.endpoint,
    path: log.path,
    originalUrl: log.originalUrl,
    service: log.service,
    status: log.statusCode,
    durationMs: log.durationMs,
    createdAt: requestTime(log.createdAt),
    replayResults: matchingFailure?.replayResults ?? [],
    errorMessage: matchingFailure?.errorMessage ?? null,
  };
};

const mapFailureRequest = (failure: FailureRecord) => ({
  id: `failure-${failure.id}`,
  type: "failure",
  source: "failureLog",
  traceId: failure.traceId,
  failureId: failure.id,
  method: failure.method,
  endpoint: failure.endpoint,
  path: failure.path,
  originalUrl: failure.originalUrl,
  service: "failure-logger",
  status: failure.responseStatus,
  durationMs: failure.durationMs,
  createdAt: requestTime(failure.createdAt),
  replayResults: failure.replayResults,
  errorMessage: failure.errorMessage,
});

const buildRequests = (apiLogs: ApiLogRecord[], failures: FailureRecord[]) => {
  const failuresByKey = new Map(failures.map((failure) => [buildFailureKey(failure), failure]));
  const seenFailureIds = new Set<string>();

  const apiRequests = apiLogs.map((log) => {
    const request = mapApiRequest(log, failuresByKey);
    if (request.failureId) {
      seenFailureIds.add(request.failureId);
    }
    return request;
  });

  const failureRequests = failures
    .filter((failure) => !seenFailureIds.has(failure.id))
    .map(mapFailureRequest);

  return [...apiRequests, ...failureRequests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, REQUEST_LIMIT);
};

const buildNodes = (apiLogs: ApiLogRecord[], failures: FailureRecord[]) => {
  const nodes = new Map<
    string,
    {
      id: string;
      service: string;
      endpoint: string;
      requestCount: number;
      failureCount: number;
      durations: number[];
      lastSeenAt: string;
      status: "stable" | "warning" | "critical";
    }
  >();

  const ensureNode = (service: string, endpoint: string, createdAt: Date) => {
    const id = `${service}:${endpoint}`;
    const existing = nodes.get(id);

    if (existing) {
      if (createdAt.toISOString() > existing.lastSeenAt) {
        existing.lastSeenAt = createdAt.toISOString();
      }
      return existing;
    }

    const node = {
      id,
      service,
      endpoint,
      requestCount: 0,
      failureCount: 0,
      durations: [] as number[],
      lastSeenAt: createdAt.toISOString(),
      status: "stable" as const,
    };

    nodes.set(id, node);
    return node;
  };

  for (const log of apiLogs) {
    const node = ensureNode(log.service, log.endpoint, log.createdAt);
    node.requestCount += 1;
    node.durations.push(log.durationMs);
    if (log.statusCode >= 400) {
      node.failureCount += 1;
    }
  }

  for (const failure of failures) {
    const node = ensureNode("failure-logger", failure.endpoint, failure.createdAt);
    node.requestCount += 1;
    node.failureCount += 1;
    node.durations.push(failure.durationMs);
  }

  return [...nodes.values()]
    .map((node) => {
      const failureRate = node.requestCount ? node.failureCount / node.requestCount : 0;
      const status =
        failureRate >= 0.35 ? "critical" : failureRate > 0 ? "warning" : "stable";

      return {
        id: node.id,
        service: node.service,
        endpoint: node.endpoint,
        requestCount: node.requestCount,
        failureCount: node.failureCount,
        failureRate: roundTo(failureRate, 4),
        averageLatencyMs: roundTo(average(node.durations)),
        p95LatencyMs: percentile(node.durations, 95),
        lastSeenAt: node.lastSeenAt,
        status,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, NODE_LIMIT);
};

const countRecent = (records: { createdAt: Date }[]) => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  return records.filter((record) => record.createdAt.getTime() >= cutoff).length;
};

export const getControlCenterData = async () => {
  const [
    apiLogs,
    failures,
    replayResultCount,
    apiLogCount,
    failureLogCount,
  ] = await Promise.all([
    getRecentApiLogs(),
    getRecentFailures(),
    prisma.replayResult.count(),
    prisma.apiLog.count(),
    prisma.failureLog.count(),
  ]);

  const requests = buildRequests(apiLogs, failures);
  const nodes = buildNodes(apiLogs, failures);
  const durations = requests.map((request) => request.durationMs);
  const failureCount = requests.filter((request) => request.status >= 400).length;

  return {
    generatedAt: new Date().toISOString(),
    database: {
      connected: true,
      provider: "postgresql",
      tables: {
        apiLogs: apiLogCount,
        failureLogs: failureLogCount,
        replayResults: replayResultCount,
      },
    },
    summary: {
      recentRequestCount: requests.length,
      recentRequestsLastHour: countRecent([...apiLogs, ...failures]),
      recentFailureCount: failureCount,
      failureRate: requests.length ? roundTo(failureCount / requests.length, 4) : 0,
      averageLatencyMs: roundTo(average(durations)),
      p95LatencyMs: percentile(durations, 95),
      serviceCount: new Set(nodes.map((node) => node.service)).size,
      nodeCount: nodes.length,
    },
    config: {
      nodeEnv: env.nodeEnv,
      replayQueueEnabled: env.replayQueueEnabled,
      replayBaseUrl: env.replayBaseUrl,
      replayWorkerConcurrency: env.replayWorkerConcurrency,
      replaySyncConcurrency: env.replaySyncConcurrency,
      replayJobAttempts: env.replayJobAttempts,
      replayJobBackoffMs: env.replayJobBackoffMs,
      replayJobMaxStalledCount: env.replayJobMaxStalledCount,
      replayJobStalledIntervalMs: env.replayJobStalledIntervalMs,
    },
    requests,
    nodes,
  };
};
