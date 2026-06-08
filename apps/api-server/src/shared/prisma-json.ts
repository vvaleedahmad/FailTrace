import { Prisma } from "../generated/prisma/client.js";
import { toJsonCompatible } from "./json.js";

export const toRequiredJson = (value: unknown) =>
  toJsonCompatible(value) as Prisma.InputJsonValue;

export const toOptionalJson = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  const json = toJsonCompatible(value);

  return json === null ? Prisma.JsonNull : (json as Prisma.InputJsonValue);
};
