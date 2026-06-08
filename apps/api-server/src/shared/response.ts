import { isRecord } from "./object.js";

export const getErrorMessageFromBody = (body: unknown, fallback?: string) => {
  if (isRecord(body)) {
    const value = body.error ?? body.message;

    if (typeof value === "string") {
      return value;
    }
  }

  if (typeof body === "string") {
    return body;
  }

  return fallback;
};
