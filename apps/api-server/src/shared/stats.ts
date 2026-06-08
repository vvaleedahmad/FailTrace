export const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const percentile = (values: number[], percentileRank: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;

  return sorted[Math.max(index, 0)];
};

export const roundTo = (value: number, decimals = 2) => {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
};
