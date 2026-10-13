/**
 * Test-only VD2-1 contract simulator. No Nest provider, platform registration or hardware I/O.
 * VD2-1b must implement these semantics against the core accepted-sample boundary; this helper
 * neither qualifies a production adapter nor supplies durable persistence/cancellation proof.
 */
export interface QualificationSample {
	value: number | null;
	sampledAt: number | null;
	origin: 'live' | 'cached' | 'retained';
	valid: boolean;
	identity: string;
}

export const sampleEligible = (sample: QualificationSample, now: number, maxAgeMs: number): boolean =>
	sample.origin === 'live' &&
	sample.valid &&
	typeof sample.value === 'number' &&
	Number.isFinite(sample.value) &&
	sample.sampledAt !== null &&
	sample.sampledAt <= now &&
	now - sample.sampledAt < maxAgeMs;

export class FloorGuardContract {
	private tripped = false;

	constructor(
		private readonly identity: string,
		private readonly limit: number,
		private readonly recoveryHysteresis: number,
		private readonly maxAgeMs: number,
	) {}

	allowsHeating(sample: QualificationSample, now: number): boolean {
		if (sample.identity !== this.identity || !sampleEligible(sample, now, this.maxAgeMs)) {
			return false;
		}
		if (sample.value >= this.limit) this.tripped = true;
		if (sample.value < this.limit - this.recoveryHysteresis) this.tripped = false;
		return !this.tripped;
	}
}

export interface CommandEvidenceSnapshot {
	unresolvedOn: string[];
	observedOutput: boolean | null;
}

/** An explicit evidence ledger, not an implementation of provider ordering or durable storage. */
export class CommandEvidenceContract {
	private readonly unresolvedOn: Set<string>;
	observedOutput: boolean | null;

	constructor(snapshot: CommandEvidenceSnapshot = { unresolvedOn: [], observedOutput: null }) {
		this.unresolvedOn = new Set(snapshot.unresolvedOn);
		this.observedOutput = snapshot.observedOutput;
	}

	reserveOn(id: string): void {
		this.unresolvedOn.add(id);
	}

	observeOutput(output: boolean): void {
		this.observedOutput = output;
	}

	/** Only a qualified drain/cancellation boundary can provide these exact earlier command IDs. */
	confirmReleased(drainedOnIds: readonly string[], output: boolean): void {
		this.observedOutput = output;
		if (!output) drainedOnIds.forEach((id) => this.unresolvedOn.delete(id));
	}

	get permitsOpposedOutput(): boolean {
		return this.observedOutput === false && this.unresolvedOn.size === 0;
	}

	snapshot(): CommandEvidenceSnapshot {
		return { unresolvedOn: [...this.unresolvedOn], observedOutput: this.observedOutput };
	}
}
