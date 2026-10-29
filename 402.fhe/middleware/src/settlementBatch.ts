export const MAX_CALLS_PER_SETTLEMENT = 50;

export function settlementBatchSize(pendingCount: number): number {
  return Math.min(pendingCount, MAX_CALLS_PER_SETTLEMENT);
}
