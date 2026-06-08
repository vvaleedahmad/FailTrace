import { prisma } from "../../db.js";

type CreateApiLogInput = {
  traceId?: string;
  service: string;
  method: string;
  endpoint: string;
  path: string;
  originalUrl: string;
  statusCode: number;
  durationMs: number;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
};

type ListApiLogsQuery = {
  traceId?: string;
  endpoint?: string;
  service?: string;
  statusCode?: number;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

const buildLogFilters = (query: ListApiLogsQuery) => {
  const filters = [];

  if (query.endpoint) {
    filters.push({
      endpoint: { contains: query.endpoint, mode: "insensitive" as const },
    });
  }

  if (query.traceId) {
    filters.push({ traceId: query.traceId });
  }

  if (query.service) {
    filters.push({
      service: { equals: query.service, mode: "insensitive" as const },
    });
  }

  if (query.statusCode) {
    filters.push({ statusCode: query.statusCode });
  }

  if (query.from || query.to) {
    filters.push({
      createdAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    });
  }

  return filters.length ? { AND: filters } : {};
};

export const createApiLog = async (input: CreateApiLogInput) => {
  await prisma.apiLog.create({
    data: input,
  });
};

export const listApiLogs = async (query: ListApiLogsQuery) => {
  const where = buildLogFilters(query);

  const [items, total] = await Promise.all([
    prisma.apiLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      where,
    }),
    prisma.apiLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total,
    },
  };
};
