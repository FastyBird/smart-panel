import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PropertyCommandValue } from '../utils/property-command-value.utils';

export const PROPERTY_COMMAND_CONFIRMATION_GRACE_MS = 1_500;

export type PropertyCommandWindowState = 'pending' | 'confirmed_grace';

export interface PropertyCommandWindowTarget {
	readonly deviceId: string;
	readonly channelId: string;
	readonly propertyId: string;
}

/**
 * An opaque, generation-scoped reference to one command window. Consumers must not infer ordering
 * from its value: only an exact generation match can mutate or close a window.
 */
export interface PropertyCommandWindowHandle {
	readonly canonicalPropertyId: string;
	readonly generation: string;
}

/** A timestamped value received while a generation is active. #1009 consumes this contract. */
export interface PropertyCommandReceipt {
	readonly value: PropertyCommandValue;
	readonly receivedAt: number;
}

export interface PropertyCommandWindow {
	readonly canonicalTarget: PropertyCommandWindowTarget;
	readonly requestedTargets: readonly PropertyCommandWindowTarget[];
	readonly generation: string;
	readonly intentId: string | null;
	readonly commandedValue: PropertyCommandValue;
	readonly previousValue: PropertyCommandValue | null;
	readonly lastReceipt: PropertyCommandReceipt | null;
	readonly heldReceipt: PropertyCommandReceipt | null;
	readonly recoveryReceipt: PropertyCommandReceipt | null;
	readonly openedAt: number;
	readonly expiresAt: number;
	readonly state: PropertyCommandWindowState;
	readonly confirmedAt: number | null;
	readonly confirmationExpiresAt: number | null;
}

export interface OpenPropertyCommandWindowInput {
	readonly canonicalTarget: PropertyCommandWindowTarget;
	readonly requestedTargets: readonly PropertyCommandWindowTarget[];
	readonly intentId?: string;
	readonly commandedValue: PropertyCommandValue;
	readonly previousValue: PropertyCommandValue | null;
	readonly ttlMs: number;
}

type MutablePropertyCommandWindow = {
	-readonly [Key in keyof PropertyCommandWindow]: PropertyCommandWindow[Key];
} & {
	requestedTargets: PropertyCommandWindowTarget[];
};

/**
 * Holds command generations only. It intentionally has no dependency on device/property services:
 * callers admit and validate targets before publishing a window, and #1009 consumes its immutable
 * snapshots at the value-commit boundary.
 */
@Injectable()
export class PropertyCommandWindowService {
	private readonly windows = new Map<string, MutablePropertyCommandWindow>();

	open(input: OpenPropertyCommandWindowInput): PropertyCommandWindowHandle {
		const now = Date.now();
		const canonicalPropertyId = input.canonicalTarget.propertyId;
		const current = this.getCurrent(canonicalPropertyId, now);
		const ttlMs = Number.isFinite(input.ttlMs) && input.ttlMs > 0 ? input.ttlMs : 3_000;
		const generation = randomUUID();
		const previousValue = current?.commandedValue ?? input.previousValue;

		this.windows.set(canonicalPropertyId, {
			canonicalTarget: freezeTarget(input.canonicalTarget),
			requestedTargets: input.requestedTargets.map(freezeTarget),
			generation,
			intentId: input.intentId ?? null,
			commandedValue: input.commandedValue,
			previousValue,
			lastReceipt: null,
			heldReceipt: null,
			recoveryReceipt: null,
			openedAt: now,
			expiresAt: now + ttlMs,
			state: 'pending',
			confirmedAt: null,
			confirmationExpiresAt: null,
		});

		return Object.freeze({ canonicalPropertyId, generation });
	}

	get(canonicalPropertyId: string): PropertyCommandWindow | null {
		return this.toSnapshot(this.getCurrent(canonicalPropertyId, Date.now()));
	}

	confirm(handle: PropertyCommandWindowHandle, receipt: PropertyCommandReceipt): PropertyCommandWindow | null {
		const current = this.getCurrent(handle.canonicalPropertyId, Date.now());

		if (current === undefined || current.generation !== handle.generation) {
			return null;
		}

		if (current.state === 'pending') {
			current.state = 'confirmed_grace';
			current.confirmedAt = receipt.receivedAt;
			current.confirmationExpiresAt = receipt.receivedAt + PROPERTY_COMMAND_CONFIRMATION_GRACE_MS;
			current.lastReceipt = freezeReceipt(receipt);
		}

		return this.toSnapshot(current);
	}

	/** Closes only an unconfirmed window that this invocation still owns. */
	fail(handle: PropertyCommandWindowHandle): boolean {
		const current = this.getCurrent(handle.canonicalPropertyId, Date.now());

		if (current === undefined || current.generation !== handle.generation || current.state !== 'pending') {
			return false;
		}

		this.windows.delete(handle.canonicalPropertyId);

		return true;
	}

	/** Removes windows whose actual deadline elapsed; callers own any recovery work. */
	sweep(): readonly PropertyCommandWindowHandle[] {
		const now = Date.now();
		const expired: PropertyCommandWindowHandle[] = [];

		for (const [canonicalPropertyId, window] of this.windows) {
			if (!this.isExpired(window, now)) {
				continue;
			}

			this.windows.delete(canonicalPropertyId);
			expired.push(Object.freeze({ canonicalPropertyId, generation: window.generation }));
		}

		return Object.freeze(expired);
	}

	clear(): void {
		this.windows.clear();
	}

	private getCurrent(canonicalPropertyId: string, now: number): MutablePropertyCommandWindow | undefined {
		const current = this.windows.get(canonicalPropertyId);

		if (current !== undefined && this.isExpired(current, now)) {
			this.windows.delete(canonicalPropertyId);

			return undefined;
		}

		return current;
	}

	private isExpired(window: MutablePropertyCommandWindow, now: number): boolean {
		return now >= (window.confirmationExpiresAt ?? window.expiresAt);
	}

	private toSnapshot(window: MutablePropertyCommandWindow | undefined): PropertyCommandWindow | null {
		if (window === undefined) {
			return null;
		}

		return Object.freeze({
			...window,
			canonicalTarget: freezeTarget(window.canonicalTarget),
			requestedTargets: Object.freeze(window.requestedTargets.map(freezeTarget)),
			lastReceipt: window.lastReceipt === null ? null : freezeReceipt(window.lastReceipt),
			heldReceipt: window.heldReceipt === null ? null : freezeReceipt(window.heldReceipt),
			recoveryReceipt: window.recoveryReceipt === null ? null : freezeReceipt(window.recoveryReceipt),
		});
	}
}

const freezeTarget = (target: PropertyCommandWindowTarget): PropertyCommandWindowTarget => Object.freeze({ ...target });

const freezeReceipt = (receipt: PropertyCommandReceipt): PropertyCommandReceipt => Object.freeze({ ...receipt });
