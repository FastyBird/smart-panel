import { randomUUID } from 'node:crypto';

import { Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PermissionType } from '../devices.constants';
import { PropertyValueState } from '../models/property-value-state.model';
import { IDevicePropertyData } from '../platforms/device.platform';
import { PropertyCommandValue, validatePropertyCommandValue } from '../utils/property-command-value.utils';

import { ChannelsService } from './channels.service';
import { CommandLatencyTraceCollectorService } from './command-latency-trace-collector.service';
import {
	CompositeChildOutcome,
	CompositeCommandOutcome,
	CompositePropertyCommandRegistryService,
} from './composite-property-command.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from './property-command-admission.registry.service';
import {
	PropertyCommandWindowHandle,
	PropertyCommandWindowService,
	PropertyCommandWindowTarget,
} from './property-command-window.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

export interface PropertyCommandDispatchOptions {
	readonly intentId?: string;
	readonly ttlMs?: number;
	/** The caller already performed its platform-specific preparation. The dispatcher never prepares again. */
	readonly prepared?: boolean;
	/** A PATCH generation admitted before its optimistic local persistence. */
	readonly windowHandles?: readonly PropertyCommandWindowHandle[];
}

export interface PropertyCommandDispatchResult {
	readonly success: boolean;
	readonly reason?: string;
	readonly composite?: CompositeCommandOutcome;
}

/** A pre-admitted API PATCH generation, kept internal to the devices module. */
export interface PreparedApiPropertyCommand {
	readonly handle: PropertyCommandWindowHandle;
	readonly canonicalPropertyId: string;
	readonly baseline: PropertyValueState | null;
	readonly optimisticEligible: boolean;
}

interface WindowAdmission {
	readonly canonicalPropertyId: string;
	readonly canonicalTarget: PropertyCommandWindowTarget;
	readonly requestedTargets: readonly PropertyCommandWindowTarget[];
	readonly commandedValue: PropertyCommandValue;
	readonly previousValue: PropertyCommandValue | null;
	readonly baseline: PropertyValueState | null;
	readonly eligible: boolean;
}

interface AdmittedWindow {
	readonly handle: PropertyCommandWindowHandle;
	readonly admission: WindowAdmission;
}

/**
 * Brackets one existing platform batch call with command-window ownership. It deliberately does
 * not prepare, re-route, or otherwise change platform I/O; alias/source validation is completed
 * under the lifecycle admission before that platform call begins.
 */
@Injectable()
export class PropertyCommandDispatchService {
	constructor(
		private readonly propertyMetadata: PropertyMetadataService,
		private readonly propertyValues: PropertyValueService,
		private readonly channelsService: ChannelsService,
		private readonly devicesService: DevicesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly structureLock: DeviceStructureLockService,
		private readonly propertyStateCoordinator: PropertyStateCoordinatorService,
		private readonly commandWindowService: PropertyCommandWindowService,
		@Optional()
		private readonly commandLatencyTraceCollector: CommandLatencyTraceCollectorService = new CommandLatencyTraceCollectorService(),
		@Optional() private readonly composites?: CompositePropertyCommandRegistryService,
		@Optional() private readonly events?: EventEmitter2,
		@Optional() private readonly admissionGuards?: PropertyCommandAdmissionRegistryService,
	) {}

	async dispatchBatch(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions = {},
	): Promise<PropertyCommandDispatchResult> {
		if (updates.length === 0) {
			return { success: true };
		}

		const planner = updates.map((update) => this.composites?.get(update.property)).find(Boolean);
		if (planner) return this.dispatchComposite(updates, options);

		const platform = this.platformRegistryService.get(updates[0].device);

		if (platform === null) {
			return { success: false, reason: 'Unsupported device type' };
		}

		const handles = options.windowHandles ?? (await this.admitWindows(updates, options))?.map(({ handle }) => handle);

		if (handles === undefined) {
			return { success: false, reason: 'Canonical property target is invalid or conflicts within the batch' };
		}
		if (options.windowHandles !== undefined && !(await this.verifyPreopenedWindows(updates, handles))) {
			this.failOwned(handles);

			return { success: false, reason: 'Canonical property target changed before dispatch' };
		}

		try {
			const success = await platform.processBatch([...updates]);

			if (!success) {
				this.failOwned(handles);

				return { success: false, reason: 'Execution failed' };
			}

			return { success: true };
		} catch (error) {
			this.failOwned(handles);

			throw error;
		}
	}

	/** Composite commands reuse physical admission and exact generation readback, never aggregate equality. */
	private async dispatchComposite(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions,
	): Promise<PropertyCommandDispatchResult> {
		const id = randomUUID();
		const deadline = Date.now() + Math.min(Math.max(options.ttlMs ?? 10_000, 1), 30_000);
		const planner = updates.map((update) => this.composites.get(update.property)).find(Boolean);
		let plan: Awaited<ReturnType<typeof planner.plan>>;
		try {
			plan = await this.withCompositeDeadline(
				this.structureLock.runShared(() =>
					planner.plan(updates.filter((update) => planner.canHandle(update.property))),
				),
				deadline,
			);
			plan = {
				...plan,
				children: [
					...plan.children,
					...updates
						.filter((update) => !planner.canHandle(update.property))
						.map((update) => ({ memberId: update.channel.id, update })),
				],
			};
		} catch (error) {
			return { success: false, reason: error instanceof Error ? error.message : 'Invalid composite plan' };
		}
		if (!plan.children.length || plan.children.length > 2048)
			return { success: false, reason: 'Composite size exceeds bounds' };
		const outcomes: CompositeChildOutcome[] = plan.children.map((child) => ({
			memberId: child.memberId,
			propertyId: child.update?.property.id ?? null,
			status: child.update ? 'accepted' : 'unavailable',
			reason: child.reason,
		}));
		const leaves = new Map<string, { update: IDevicePropertyData; indexes: number[] }>();
		for (const [index, child] of plan.children.entries()) {
			if (!child.update) continue;
			const canonical = this.valueSourceRegistry.resolve(child.update.property);
			const existing = leaves.get(canonical);
			if (existing && existing.update.value !== child.update.value)
				return { success: false, reason: 'Contradictory canonical targets in composite command' };
			if (existing) existing.indexes.push(index);
			else leaves.set(canonical, { update: child.update, indexes: [index] });
		}
		const work = [...leaves.values()];
		let cursor = 0;
		const publish = () =>
			this.events?.emit('DevicesModule.Internal.CompositeCommandProgress', {
				id,
				children: outcomes.map((child) => ({ ...child })),
			});
		publish();
		const workers = Array.from({ length: Math.min(8, work.length) }, async () => {
			while (cursor < work.length) {
				const leaf = work[cursor++];
				const set = (status: CompositeChildOutcome['status'], reason?: string, generation?: string) => {
					for (const index of leaf.indexes) Object.assign(outcomes[index], { status, reason, generation });
					publish();
				};
				let handles: readonly PropertyCommandWindowHandle[] = [];
				try {
					if (Date.now() >= deadline) {
						set('timed_out');
						continue;
					}
					if (!(await plan.isCurrent())) {
						set('superseded', 'Binding revision changed');
						continue;
					}
					const admitted = await this.admitWindows([leaf.update], {
						intentId: options.intentId,
						ttlMs: deadline - Date.now(),
					});
					handles = admitted?.map((window) => window.handle) ?? [];
					if (!admitted || !handles.length) {
						set('unavailable', 'No correlated physical readback admission');
						continue;
					}
					const handle = handles[0];
					set('accepted', undefined, handle.generation);
					const dispatched = await this.withCompositeDeadline(
						this.dispatchBatch([leaf.update], { ...options, windowHandles: handles }),
						deadline,
					);
					if (!dispatched.success) {
						set('failed', dispatched.reason);
						continue;
					}
					while (Date.now() < deadline) {
						if (!(await plan.isCurrent())) {
							set('superseded', 'Binding revision changed');
							break;
						}
						const window = this.commandWindowService.get(handle.canonicalPropertyId);
						if (!window || window.generation !== handle.generation) {
							set('superseded', 'Physical command generation replaced');
							break;
						}
						if (window.state === 'confirmed_grace') {
							set('confirmed', undefined, handle.generation);
							break;
						}
						await new Promise<void>((resolve) => setTimeout(resolve, Math.min(20, Math.max(1, deadline - Date.now()))));
					}
					if (leaf.indexes.some((index) => outcomes[index].status === 'accepted')) set('timed_out');
				} catch (error) {
					set(
						Date.now() >= deadline ? 'timed_out' : 'failed',
						error instanceof Error ? error.message : 'Execution failed',
					);
				} finally {
					for (const index of leaf.indexes) if (outcomes[index].status !== 'confirmed') this.failOwned(handles);
				}
			}
		});
		await Promise.all(workers);
		const confirmed = outcomes.filter((child) => child.status === 'confirmed').length;
		const composite: CompositeCommandOutcome = {
			id,
			status: confirmed === outcomes.length ? 'confirmed' : confirmed > 0 ? 'partial' : 'failed',
			children: outcomes,
		};
		this.events?.emit('DevicesModule.Internal.CompositeCommandCompleted', composite);
		return {
			success: composite.status === 'confirmed',
			composite,
			reason: composite.status === 'confirmed' ? undefined : `Composite command ${composite.status}`,
		};
	}

	private async withCompositeDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
		let timer: NodeJS.Timeout;
		try {
			return await Promise.race([
				operation,
				new Promise<T>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('Composite deadline exceeded')),
						Math.max(1, deadline - Date.now()),
					);
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	/**
	 * Opens the generation that an API PATCH will later dispatch. The caller uses the returned receipt
	 * only for a direct source with a known baseline; projections and authoritative sources remain
	 * command-only and cannot fabricate source measurements.
	 */
	async prepareApiCommand(update: IDevicePropertyData, ttlMs: number): Promise<PreparedApiPropertyCommand | null> {
		const admitted = await this.admitWindows([update], { ttlMs });
		const first = admitted?.[0];

		if (first === undefined) {
			return null;
		}

		return {
			handle: first.handle,
			canonicalPropertyId: first.admission.canonicalPropertyId,
			baseline: first.admission.baseline,
			optimisticEligible:
				first.admission.canonicalPropertyId === update.property.id && first.admission.baseline !== null,
		};
	}

	private async admitWindows(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions,
	): Promise<readonly AdmittedWindow[] | null> {
		return this.structureLock.runShared(async () => {
			const requestedByCanonical = new Map<string, IDevicePropertyData[]>();

			for (const update of updates) {
				const canonicalPropertyId = this.valueSourceRegistry.resolve(update.property);
				const requested = requestedByCanonical.get(canonicalPropertyId) ?? [];

				requested.push(update);
				requestedByCanonical.set(canonicalPropertyId, requested);
			}

			const admitted: AdmittedWindow[] = [];

			for (const [canonicalPropertyId, requestedUpdates] of requestedByCanonical) {
				const admission = await this.propertyStateCoordinator.run(canonicalPropertyId, async () =>
					this.createAdmission(canonicalPropertyId, requestedUpdates),
				);

				if (admission === null) {
					this.failOwned(admitted.map(({ handle }) => handle));

					return null;
				}

				if (!admission.eligible) {
					continue;
				}

				const handle = this.commandWindowService.open({
					canonicalTarget: admission.canonicalTarget,
					requestedTargets: admission.requestedTargets,
					intentId: options.intentId,
					commandedValue: admission.commandedValue,
					previousValue: admission.previousValue,
					ttlMs: options.ttlMs ?? 3_000,
				});
				this.commandLatencyTraceCollector.bindWindow(
					options.intentId,
					admission.canonicalPropertyId,
					handle.generation,
				);
				admitted.push({
					handle,
					admission,
				});
			}

			return admitted;
		});
	}

	private async createAdmission(
		canonicalPropertyId: string,
		requestedUpdates: readonly IDevicePropertyData[],
	): Promise<WindowAdmission | null> {
		const first = requestedUpdates[0];

		if (first === undefined) {
			return null;
		}

		// Read the invalidation-aware catalog while the lifecycle barrier is held. A remap is never
		// silently authorized as a command to a different source between validation and forwarding.
		for (const requested of requestedUpdates) {
			const currentRequested = await this.propertyMetadata.findOne(requested.property.id);

			if (currentRequested === null || this.valueSourceRegistry.resolve(currentRequested) !== canonicalPropertyId) {
				return null;
			}
		}

		const sourceProperty = await this.propertyMetadata.findOne(canonicalPropertyId);

		if (sourceProperty === null || this.valueSourceRegistry.resolve(sourceProperty) !== sourceProperty.id) {
			return null;
		}

		// Metadata includes the channel and device, invalidated by structural writes and settlement.
		// Admission needs their identities/type, not another full graph and every sibling value.
		const sourceChannel =
			typeof sourceProperty.channel === 'string'
				? await this.channelsService.findOne(sourceProperty.channel)
				: (sourceProperty.channel ?? null);
		const sourceDevice =
			typeof sourceChannel?.device === 'string'
				? await this.devicesService.findOne(sourceChannel.device)
				: (sourceChannel?.device ?? null);

		if (sourceChannel === null || sourceDevice === null) {
			return null;
		}

		let commandedValue: PropertyCommandValue | undefined;

		for (const requested of requestedUpdates) {
			const validation = validatePropertyCommandValue(sourceProperty, requested.value);

			if (!validation.valid || validation.value === undefined) {
				return null;
			}

			if (commandedValue !== undefined && commandedValue !== validation.value) {
				return null;
			}

			commandedValue = validation.value;
		}

		if (commandedValue === undefined) {
			return null;
		}

		await this.admissionGuards?.assertAllowed({
			device: sourceDevice,
			channel: sourceChannel,
			property: sourceProperty,
			value: commandedValue,
		});

		// Values are runtime state, never part of the structural catalog. Read the current baseline
		// under the source coordinator just as admission previously did through ORM afterLoad.
		const baseline = await this.propertyValues.readLatest(sourceProperty);
		sourceProperty.value = baseline;

		const requestedTargets = requestedUpdates.map(toTarget);
		const canonicalTarget = toTarget({ device: sourceDevice, channel: sourceChannel, property: sourceProperty });
		const writable = sourceProperty.permissions.includes(PermissionType.READ_WRITE);
		const authoritative = this.platformRegistryService.usesAuthoritativePropertyReadback(sourceDevice, sourceProperty);

		return {
			canonicalPropertyId,
			canonicalTarget,
			requestedTargets,
			commandedValue,
			previousValue: baseline?.value ?? null,
			baseline: baseline === null ? null : new PropertyValueState(baseline.value, baseline.lastUpdated, baseline.trend),
			eligible: writable && !authoritative,
		};
	}

	/** Revalidates a receipt's requested alias/source identity before platform I/O without opening another generation. */
	private async verifyPreopenedWindows(
		updates: readonly IDevicePropertyData[],
		handles: readonly PropertyCommandWindowHandle[],
	): Promise<boolean> {
		return this.structureLock.runShared(async () => {
			const requestedByCanonical = new Map<string, IDevicePropertyData[]>();

			for (const update of updates) {
				const current = await this.propertyMetadata.findOne(update.property.id);
				if (current === null) {
					return false;
				}

				const canonicalPropertyId = this.valueSourceRegistry.resolve(current);
				const requested = requestedByCanonical.get(canonicalPropertyId) ?? [];
				requested.push({ ...update, property: current });
				requestedByCanonical.set(canonicalPropertyId, requested);
			}

			if (requestedByCanonical.size !== handles.length) {
				return false;
			}

			for (const [canonicalPropertyId, requestedUpdates] of requestedByCanonical) {
				const handle = handles.find((candidate) => candidate.canonicalPropertyId === canonicalPropertyId);
				if (handle === undefined) {
					return false;
				}

				const admission = await this.propertyStateCoordinator.run(canonicalPropertyId, async () =>
					this.createAdmission(canonicalPropertyId, requestedUpdates),
				);
				const window = this.commandWindowService.get(canonicalPropertyId);

				if (admission === null || !admission.eligible || window === null || window.generation !== handle.generation) {
					return false;
				}
			}

			return true;
		});
	}

	private failOwned(handles: readonly PropertyCommandWindowHandle[]): void {
		for (const handle of handles) {
			this.commandWindowService.fail(handle);
		}
	}
}

const toTarget = ({
	device,
	channel,
	property,
}: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): PropertyCommandWindowTarget => ({
	deviceId: device.id,
	channelId: channel.id,
	propertyId: property.id,
});
