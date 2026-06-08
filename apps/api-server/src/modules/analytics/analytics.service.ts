import { prisma } from "../../db.js";
import { average, percentile, roundTo } from "../../shared/stats.js";

type AnalyticsQuery = {
  from?: Date;
  to?: Date;
  traceId?: string;
  endpointLimit: number;
  bucketMinutes: number;
};

type FailureRecord = {
  traceId: string | null;
  endpoint: string;
  method: string;
  responseStatus: number;
  durationMs: number;
  createdAt: Date;
};

type EndpointGroup = {
  endpoint: string;
  methods: Set<string>;
  failures: FailureRecord[];
};

type FrequencyBucket = {
  total: number;
  statusCodes: Map<number, number>;
  statusClasses: Map<string, number>;
};

const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

const getBucketStart = (date: Date, bucketMinutes: number) => {
  const bucketMs = bucketMinutes * 60 * 1000;
  const bucketStart = Math.floor(date.getTime() / bucketMs) * bucketMs;

  return new Date(bucketStart);
};

const getFailureWhere = (query: AnalyticsQuery) => {
  if (!query.from && !query.to && !query.traceId) {
    return {};
  }

  return {
    ...(query.traceId ? { traceId: query.traceId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };
};

const groupFailuresByEndpoint = (failures: FailureRecord[]) => {
  const groups = new Map<string, EndpointGroup>();

  for (const failure of failures) {
    const group = groups.get(failure.endpoint) ?? {
      endpoint: failure.endpoint,
      failures: [],
      methods: new Set<string>(),
    };

    group.failures.push(failure);
    group.methods.add(failure.method);
    groups.set(failure.endpoint, group);
  }

  return groups;
};

const latestFailureDate = (failures: FailureRecord[]) =>
  failures.reduce(
    (latest, failure) => (failure.createdAt > latest ? failure.createdAt : latest),
    failures[0]!.createdAt,
  );

const latestFailure = (failures: FailureRecord[]) =>
  failures.reduce(
    (latest, failure) => (failure.createdAt > latest.createdAt ? failure : latest),
    failures[0]!,
  );

const countMapToObject = <Key extends string | number>(counts: Map<Key, number>) =>
  Object.fromEntries([...counts.entries()].sort(([a], [b]) => (a > b ? 1 : -1)));

const getOrCreateFrequencyBucket = (
  buckets: Map<string, FrequencyBucket>,
  bucketKey: string,
) => {
  const existingBucket = buckets.get(bucketKey);

  if (existingBucket) {
    return existingBucket;
  }

  const bucket = {
    statusClasses: new Map<string, number>(),
    statusCodes: new Map<number, number>(),
    total: 0,
  };

  buckets.set(bucketKey, bucket);

  return bucket;
};

const incrementCount = <Key>(counts: Map<Key, number>, key: Key) => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const buildMostFailingEndpoints = (
  failures: FailureRecord[],
  endpointLimit: number,
) => {
  const groups = groupFailuresByEndpoint(failures);

  return [...groups.values()]
    .map((entry) => {
      const durations = entry.failures.map((failure) => failure.durationMs);

      return {
        endpoint: entry.endpoint,
        methods: [...entry.methods].sort(),
        failureCount: entry.failures.length,
        averageLatencyMs: roundTo(average(durations)),
        p95LatencyMs: percentile(durations, 95),
        latestFailureAt: latestFailureDate(entry.failures),
        latestTraceId: latestFailure(entry.failures).traceId,
      };
    })
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, endpointLimit);
};

const buildLatencyTrends = (
  failures: FailureRecord[],
  bucketMinutes: number,
) => {
  const buckets = new Map<string, FailureRecord[]>();

  for (const failure of failures) {
    const bucketStart = getBucketStart(failure.createdAt, bucketMinutes);
    const key = bucketStart.toISOString();
    buckets.set(key, [...(buckets.get(key) ?? []), failure]);
  }

  return [...buckets.entries()]
    .map(([bucketStart, bucketFailures]) => {
      const durations = bucketFailures.map((failure) => failure.durationMs);

      return {
        bucketStart,
        bucketMinutes,
        requestCount: bucketFailures.length,
        averageLatencyMs: roundTo(average(durations)),
        minLatencyMs: Math.min(...durations),
        maxLatencyMs: Math.max(...durations),
        p95LatencyMs: percentile(durations, 95),
      };
    })
    .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
};

const buildFailureFrequency = (
  failures: FailureRecord[],
  bucketMinutes: number,
) => {
  const byStatusCode = new Map<number, number>();
  const byStatusClass = new Map<string, number>();
  const buckets = new Map<string, FrequencyBucket>();

  for (const failure of failures) {
    const failureStatusClass = statusClass(failure.responseStatus);
    const bucketStart = getBucketStart(failure.createdAt, bucketMinutes);
    const bucketKey = bucketStart.toISOString();
    const bucket = getOrCreateFrequencyBucket(buckets, bucketKey);

    incrementCount(byStatusCode, failure.responseStatus);
    incrementCount(byStatusClass, failureStatusClass);
    incrementCount(bucket.statusCodes, failure.responseStatus);
    incrementCount(bucket.statusClasses, failureStatusClass);

    bucket.total += 1;
  }

  return {
    totalFailures: failures.length,
    byStatusCode: countMapToObject(byStatusCode),
    byStatusClass: countMapToObject(byStatusClass),
    timeSeries: [...buckets.entries()]
      .map(([bucketStart, bucket]) => ({
        bucketStart,
        bucketMinutes,
        totalFailures: bucket.total,
        byStatusCode: countMapToObject(bucket.statusCodes),
        byStatusClass: countMapToObject(bucket.statusClasses),
      }))
      .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart)),
  };
};

export const getAnalytics = async (query: AnalyticsQuery) => {
  const failures = await prisma.failureLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      durationMs: true,
      endpoint: true,
      method: true,
      responseStatus: true,
      traceId: true,
    },
    where: getFailureWhere(query),
  });

  return {
    filters: {
      from: query.from?.toISOString() ?? null,
      to: query.to?.toISOString() ?? null,
      traceId: query.traceId ?? null,
      bucketMinutes: query.bucketMinutes,
      endpointLimit: query.endpointLimit,
    },
    mostFailingEndpoints: buildMostFailingEndpoints(
      failures,
      query.endpointLimit,
    ),
    latencyTrends: buildLatencyTrends(failures, query.bucketMinutes),
    failureFrequency: buildFailureFrequency(failures, query.bucketMinutes),
  };
};
