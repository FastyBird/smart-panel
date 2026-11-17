import { Injectable } from '@nestjs/common';

import { ProtectStreamAvailability } from '../mappings/mapping-evaluator';

export interface ProtectStreamAvailabilityEntry {
	availability: Readonly<ProtectStreamAvailability>;
	readAt: number;
}

/** Which RTSPS streams each camera has enabled (presence booleans only, never URLs); shared by adoption and sync. */
@Injectable()
export class ProtectStreamAvailabilityStore {
	private readonly entries = new Map<string, ProtectStreamAvailabilityEntry>();

	get(cameraId: string): ProtectStreamAvailabilityEntry | null {
		return this.entries.get(cameraId) ?? null;
	}

	/** Copies the four booleans; true when they differ from the previous entry (or there was none). */
	set(cameraId: string, availability: ProtectStreamAvailability, readAt: number = Date.now()): boolean {
		const next: Readonly<ProtectStreamAvailability> = Object.freeze({
			high: availability.high === true,
			medium: availability.medium === true,
			low: availability.low === true,
			package: availability.package === true,
		});
		const previous = this.entries.get(cameraId)?.availability;

		this.entries.set(cameraId, { availability: next, readAt });

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
