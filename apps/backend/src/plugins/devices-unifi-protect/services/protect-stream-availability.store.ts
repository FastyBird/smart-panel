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

	/** Last observation time handed out; never reset, so stamps keep increasing across sessions. */
	private lastObservation = 0;

	/** Last stamp handed out before the store was cleared (a session ended); no observation at or below it is taken. */
	private sessionFloor = 0;

	/**
	 * Start time for a console request whose answer will be stored: the wall clock, but strictly greater than every
	 * stamp handed out before, so two requests never share one and a later request always outranks an earlier one.
	 */
	nextObservation(): number {
		this.lastObservation = Math.max(Date.now(), this.lastObservation + 1);

		return this.lastObservation;
	}

	/** False once the session an observation stamped at `observedAt` was requested in has ended (the store was cleared). */
	isCurrent(observedAt: number): boolean {
		return observedAt > this.sessionFloor;
	}

	get(cameraId: string): ProtectStreamAvailabilityEntry | null {
		return this.entries.get(cameraId) ?? null;
	}

	/**
	 * True when an observation made at `observedAt` belongs to the current session and is newer than what the camera's
	 * entry already holds.
	 */
	accepts(cameraId: string, observedAt: number): boolean {
		const stored = this.entries.get(cameraId);

		return this.isCurrent(observedAt) && (stored === undefined || observedAt > stored.observedAt);
	}

	/**
	 * Copies the four booleans; true when they differ from the previous entry (or there was none). `observedAt` is when
	 * the console data was requested: an observation from an ended session, or not newer than the entry's, is ignored
	 * (returns false).
	 */
	set(
		cameraId: string,
		availability: ProtectStreamAvailability,
		observedAt: number = this.nextObservation(),
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

	/** Ends the session: drops every entry and rejects every observation stamped so far, even one still in flight. */
	clear(): void {
		this.entries.clear();
		this.sessionFloor = this.lastObservation;
	}
}
