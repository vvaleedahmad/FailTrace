import { isRecord } from "./object.js";

const sensitiveKeyPattern =
  /(authorization|cookie|password|secret|token|api[-_]?key|session|client[-_]?secret|private[-_]?key|access[-_]?token|refresh[-_]?token|set-cookie)/i;

const redactValue = (value: unknown) => {
  if (typeof value === "string") {
    return "[REDACTED]";
  }

  return "[REDACTED]";
};

export const sanitizeSensitiveData = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSensitiveData(entry, seen));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (seen.has(value)) {
    return "[REDACTED]";
  }

  seen.add(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? redactValue(entry)
        : sanitizeSensitiveData(entry, seen),
    ]),
  );
};
