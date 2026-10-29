interface IssuedChallenge {
  apiId: number;
  expiresAt: number;
}

export class ChallengeStore {
  private readonly challenges = new Map<string, IssuedChallenge>();

  constructor(
    private readonly ttlMs = 5 * 60 * 1_000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000,
  ) {}

  remember(nonce: string, apiId: number): void {
    const currentTime = this.now();
    while (this.challenges.size >= this.maxEntries) {
      const oldest = this.challenges.keys().next().value;
      if (oldest === undefined) break;
      this.challenges.delete(oldest);
    }

    this.challenges.set(nonce, {
      apiId,
      expiresAt: currentTime + this.ttlMs,
    });
  }

  consume(nonce: string, apiId: number): boolean {
    const challenge = this.challenges.get(nonce);
    if (!challenge) return false;

    this.challenges.delete(nonce);
    return challenge.apiId === apiId && challenge.expiresAt >= this.now();
  }
}
