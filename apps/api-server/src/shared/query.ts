import type { Request } from "express";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export const parseDate = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const date = dateOnlyPattern.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return end;
};

export const parseDateRange = (query: Request["query"]) => {
  const date = parseDate(query.date);

  if (date) {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);

    return { from, to: endOfDay(date) };
  }

  const to = parseDate(query.to);
  const isDateOnlyTo = typeof query.to === "string" && dateOnlyPattern.test(query.to);

  return {
    from: parseDate(query.from),
    to: to && isDateOnlyTo ? endOfDay(to) : to,
  };
};

export const parseInteger = (value: unknown) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : undefined;
};

export const parseNonNegativeInteger = (value: unknown, fallback: number) => {
  const parsed = parseInteger(value);

  if (parsed === undefined || parsed < 0) {
    return fallback;
  }

  return parsed;
};

export const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = parseInteger(value);

  if (parsed === undefined || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const parseOptionalPositiveInteger = (value: unknown) => {
  const parsed = parseInteger(value);

  if (parsed === undefined || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

export const parseStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

export const parseIntegerArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => Number(item)).filter(Number.isInteger)
    : undefined;
