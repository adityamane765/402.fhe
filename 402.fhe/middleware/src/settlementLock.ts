export class SettlementLock {
  private readonly keys = new Set<string>();

  tryAcquire(requestedKeys: string[]): boolean {
    if (requestedKeys.some((key) => this.keys.has(key))) return false;
    for (const key of requestedKeys) this.keys.add(key);
    return true;
  }

  release(requestedKeys: string[]): void {
    for (const key of requestedKeys) this.keys.delete(key);
  }
}
