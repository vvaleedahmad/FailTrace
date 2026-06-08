export const toJsonCompatible = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, nestedValue) =>
        typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
      ),
    );
  } catch {
    return String(value);
  }
};
