import { Injectable } from '@nestjs/common';

import { ProtectStreamAvailability } from '../mappings/mapping-evaluator';

export interface ProtectStreamAvailabilityEntry {
	availability: Readonly<ProtectStreamAvailability>;
	/** When the entry was written; its age is the age of the observation (TTL). */
	readAt: number;
	/** When the console data behind the entry was requested; an older observation never replaces it. */
	observedAt: number;
}

/** Which RTSPS streams each camera has enabled (presence booleans only, never URLs); shared by adoption and sync. */
@Injectable()
export class ProtectStreamAvailabilityStore {
	private readonly entries = new Map<string, ProtectStreamAvailabilityEntry>();

	get(cameraId: string): ProtectStreamAvailabilityEntry | null {
		return this.entries.get(cameraId) ?? null;
	}

	/** True when an observation made at `observedAt` is not older than what the camera's entry already holds. */
	accepts(cameraId: string, observedAt: number): boolean {
		const stored = this.entries.get(cameraId);

		return stored === undefined || observedAt >= stored.observedAt;
	}

	/**
	 * Copies the four booleans; true when they differ from the previous entry (or there was none). `observedAt` is when
	 * the console data was requested: an older observation than the entry's is ignored (returns false).
	 */
	set(
		cameraId: string,
		availability: ProtectStreamAvailability,
		observedAt: number = Date.now(),
		readAt: number = Date.now(),
	): boolean {
		if (!this.accepts(cameraId, observedAt)) {
			return false;
		}

		const next: Readonly<ProtectStreamAvailability> = Object.freeze({
			high: availability.high === true,
			medium: availability.medium === true,
			low: availability.low === true,
			package: availability.package === true,
		});
		const previous = this.entries.get(cameraId)?.availability;

		this.entries.set(cameraId, { availability: next, readAt, observedAt });

		return (
			previous === undefined ||
			previous.high !== next.high ||
			previous.medium !== next.medium ||
			previous.low !== next.low ||
			previous.package !== next.package
		);
	}

	clear(): void {
		this.entries.clear();
	}
}
