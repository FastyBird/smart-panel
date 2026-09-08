import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PropertyValueState } from '../models/property-value-state.model';
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

/** Internal optimistic PATCH state. It never crosses a transport or event boundary. */
export interface PropertyCommandPatchReceipt {
	readonly baseline: PropertyValueState;
	readonly optimisticState: PropertyValueState;
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
	readonly patchReceipt: PropertyCommandPatchReceipt | null;
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

interface RecoveryWindow {
	readonly window: MutablePropertyCommandWindow;
	readonly deadlineAt: number;
}

/**
 * Holds command generations only. It intentionally has no dependency on device/property services:
 * callers admit and validate targets before publishing a window, and #1009 consumes its immutable
 * snapshots at the value-commit boundary.
 */
@Injectable()
export class PropertyCommandWindowService {
	private readonly windows = new Map<string, MutablePropertyCommandWindow>();
	private readonly recoveries = new Map<string, RecoveryWindow>();

	open(input: OpenPropertyCommandWindowInput): PropertyCommandWindowHandle {
		const now = Date.now();
		const canonicalPropertyId = input.canonicalTarget.propertyId;
		const current = this.getCurrent(canonicalPropertyId, now);
		const ttlMs = Number.isFinite(input.ttlMs) && input.ttlMs > 0 ? input.ttlMs : 3_000;
		const generation = randomUUID();
		const previousValue = current?.commandedValue ?? input.previousValue;
		this.recoveries.delete(canonicalPropertyId);

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
			// A replacement command's observed baseline remains the oldest unconfirmed PATCH baseline.
			// Its own optimistic revision is attached only after persistence succeeds.
			patchReceipt: current?.patchReceipt ?? null,
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
			current.heldReceipt = null;
			current.patchReceipt = null;
		}

		return this.toSnapshot(current);
	}

	/** Associates a successfully persisted API PATCH revision with its owning generation. */
	attachPatchReceipt(handle: PropertyCommandWindowHandle, receipt: PropertyCommandPatchReceipt): boolean {
		const current = this.getCurrent(handle.canonicalPropertyId, Date.now());

		if (current === undefined || current.generation !== handle.generation || current.state !== 'pending') {
			return false;
		}

		current.patchReceipt = freezePatchReceipt({
			baseline: current.patchReceipt?.baseline ?? receipt.baseline,
			optimisticState: receipt.optimisticState,
		});

		return true;
	}

	/** Retains only the newest stale report while this generation is still awaiting confirmation. */
	hold(handle: PropertyCommandWindowHandle, receipt: PropertyCommandReceipt): PropertyCommandWindow | null {
		const current = this.getCurrent(handle.canonicalPropertyId, Date.now());

		if (current === undefined || current.generation !== handle.generation || current.state !== 'pending') {
			return null;
		}

		current.heldReceipt = freezeReceipt(receipt);

		return this.toSnapshot(current);
	}

	/** Removes a generation after a distinct external report becomes the source of truth. */
	close(handle: PropertyCommandWindowHandle): boolean {
		const current = this.windows.get(handle.canonicalPropertyId);

		if (current !== undefined && current.generation === handle.generation) {
			this.windows.delete(handle.canonicalPropertyId);

			return true;
		}

		return false;
	}

	/** Closes only an unconfirmed window that this invocation still owns. */
	fail(handle: PropertyCommandWindowHandle): boolean {
		const current = this.getCurrent(handle.canonicalPropertyId, Date.now());

		if (current === undefined || current.generation !== handle.generation || current.state !== 'pending') {
			return false;
		}

		this.detach(handle.canonicalPropertyId, current);

		return true;
	}

	/**
	 * Detaches expired windows and returns recovery generations with a held provider report or a
	 * generation-fenced optimistic PATCH fallback. ChannelsPropertiesService owns their commit.
	 */
	sweep(): readonly PropertyCommandWindowHandle[] {
		const now = Date.now();

		for (const [canonicalPropertyId, window] of this.windows) {
			if (!this.isExpired(window, now)) {
				continue;
			}

			this.detach(canonicalPropertyId, window);
		}
		this.pruneRecoveries(now);

		return Object.freeze(
			[...this.recoveries.entries()].map(([canonicalPropertyId, recovery]) =>
				Object.freeze({ canonicalPropertyId, generation: recovery.window.generation }),
			),
		);
	}

	/** Detaches an elapsed active generation before a fresh report is classified. */
	expire(canonicalPropertyId: string): PropertyCommandWindowHandle | null {
		const current = this.windows.get(canonicalPropertyId);

		if (current === undefined || !this.isExpired(current, Date.now())) {
			return null;
		}

		this.detach(canonicalPropertyId, current);

		return Object.freeze({ canonicalPropertyId, generation: current.generation });
	}

	getRecovery(handle: PropertyCommandWindowHandle): PropertyCommandWindow | null {
		this.pruneRecoveries(Date.now());
		const recovery = this.recoveries.get(handle.canonicalPropertyId);

		return recovery?.window.generation === handle.generation ? this.toSnapshot(recovery.window) : null;
	}

	completeRecovery(handle: PropertyCommandWindowHandle): boolean {
		const recovery = this.recoveries.get(handle.canonicalPropertyId);

		if (recovery === undefined || recovery.window.generation !== handle.generation) {
			return false;
		}

		this.recoveries.delete(handle.canonicalPropertyId);

		return true;
	}

	cancelRecovery(canonicalPropertyId: string): void {
		this.recoveries.delete(canonicalPropertyId);
	}

	cancel(canonicalPropertyId: string): void {
		this.windows.delete(canonicalPropertyId);
		this.recoveries.delete(canonicalPropertyId);
	}

	clear(): void {
		this.windows.clear();
		this.recoveries.clear();
	}

	private getCurrent(canonicalPropertyId: string, now: number): MutablePropertyCommandWindow | undefined {
		const current = this.windows.get(canonicalPropertyId);

		if (current !== undefined && this.isExpired(current, now)) {
			this.detach(canonicalPropertyId, current);

			return undefined;
		}

		return current;
	}

	private isExpired(window: MutablePropertyCommandWindow, now: number): boolean {
		return now >= (window.confirmationExpiresAt ?? window.expiresAt);
	}

	private detach(canonicalPropertyId: string, window: MutablePropertyCommandWindow, now = Date.now()): void {
		this.windows.delete(canonicalPropertyId);

		if (window.state === 'pending' && (window.heldReceipt !== null || window.patchReceipt !== null)) {
			this.recoveries.set(canonicalPropertyId, {
				window,
				deadlineAt: now + (window.expiresAt - window.openedAt),
			});
		}
	}

	private pruneRecoveries(now: number): void {
		for (const [canonicalPropertyId, recovery] of this.recoveries) {
			if (now >= recovery.deadlineAt) {
				this.recoveries.delete(canonicalPropertyId);
			}
		}
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
			patchReceipt: window.patchReceipt === null ? null : freezePatchReceipt(window.patchReceipt),
		});
	}
}

const freezeTarget = (target: PropertyCommandWindowTarget): PropertyCommandWindowTarget => Object.freeze({ ...target });

const freezeReceipt = (receipt: PropertyCommandReceipt): PropertyCommandReceipt => Object.freeze({ ...receipt });

const freezePatchReceipt = (receipt: PropertyCommandPatchReceipt): PropertyCommandPatchReceipt =>
	Object.freeze({
		baseline: freezeValueState(receipt.baseline),
		optimisticState: freezeValueState(receipt.optimisticState),
	});

const freezeValueState = (state: PropertyValueState): PropertyValueState =>
	Object.freeze(new PropertyValueState(state.value, state.lastUpdated, state.trend));
