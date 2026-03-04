/**
 * Generic in-memory cooldown manager.
 *
 * Tracks per-key cooldowns using a `Map<string, number>` where the value
 * is the timestamp (ms) when the cooldown expires.
 *
 * @typeParam T - The type enum used alongside a scope key to form the cooldown key.
 */
export class CooldownManager<T extends string> {
	private readonly cooldowns = new Map<string, number>();

	private getKey(scope: string, type: T): string {
		return `${scope}:${type}`;
	}

	isOnCooldown(scope: string, type: T, now: number = Date.now()): boolean {
		const cooldownUntil = this.cooldowns.get(this.getKey(scope, type));

		if (!cooldownUntil) {
			return false;
		}

		return now < cooldownUntil;
	}

	setCooldown(scope: string, type: T, durationMs: number, now: number = Date.now()): void {
		this.cooldowns.set(this.getKey(scope, type), now + durationMs);
	}

	clearCooldown(scope: string, type: T): void {
		this.cooldowns.delete(this.getKey(scope, type));
	}

	clearAll(): void {
		this.cooldowns.clear();
	}
}
