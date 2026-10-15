import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PermissionType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';
import { IDevicePropertyData, PreparedCompositeDeviceBatch, PreparedCoverAction } from '../platforms/device.platform';
import { PropertyCommandValue, validatePropertyCommandValue } from '../utils/property-command-value.utils';

import { ChannelsService } from './channels.service';
import { CommandLatencyTraceCollectorService } from './command-latency-trace-collector.service';
import {
	CompositeChildOutcome,
	CompositeCommandOutcome,
	CompositePropertyCommandRegistryService,
} from './composite-property-command.registry.service';
import { coverActionContext, coverConfirmationReason, isCoverControl, validCoverAction } from './cover-action-proof';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import {
	PropertyCommandAdmissionRegistryService,
	PropertyCommandAdmissionSnapshot,
	PropertyCommandEffect,
} from './property-command-admission.registry.service';
import { PropertyCommandEntrySnapshot } from './property-command-entry-snapshot';
import {
	PropertyCommandWindowHandle,
	PropertyCommandWindowService,
	PropertyCommandWindowTarget,
} from './property-command-window.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

export const COMPOSITE_INTENT_FINISH_MARGIN_MS = 100;

class CompositeAdmissionSnapshotChangedError extends Error {}
class CompositeDeadlineExceededError extends Error {}

export interface PropertyCommandDispatchOptions {
	readonly intentId?: string;
	readonly requestId?: string;
	/** Minted internal request lifetime evidence; never read from a public DTO. */
	readonly commandEntry?: PropertyCommandEntrySnapshot;
	/** Internal caller selection fence, captured before room/budget metadata awaits. */
	readonly isRequestCurrent?: () => boolean;
	readonly ttlMs?: number;
	/** Internal absolute bound for a composite admission; never supplied by a public DTO. */
	readonly deadlineAt?: number;
	/** Internal stricter acknowledgement policy for expanded physical leaves. */
	readonly requiresLiveEvidence?: boolean;
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
	readonly effectScope?: string;
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
export class PropertyCommandDispatchService implements OnModuleDestroy {
	private readonly eventEpoch = randomUUID();
	private eventSequence = 0;
	private disposed = false;
	private activeComposites = 0;
	private readonly compositeCleanups = new Set<() => void>();
	onModuleDestroy(): void {
		this.disposed = true;
		for (const cleanup of this.compositeCleanups) cleanup();
		this.compositeCleanups.clear();
	}

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

	/** Dispatches ordinary batches or composite leaves under captured request and ownership fences. */
	async dispatchBatch(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions = {},
	): Promise<PropertyCommandDispatchResult> {
		const admission = this.admissionGuards?.capture?.();
		const isCurrent = () =>
			(options.commandEntry?.isActive() ?? true) &&
			(options.isRequestCurrent?.() ?? true) &&
			(options.deadlineAt === undefined || Date.now() < options.deadlineAt) &&
			(admission?.isRequestCurrent?.() ?? admission?.isCurrent() ?? true);
		const isLeafCurrent = (update: IDevicePropertyData) =>
			isCurrent() && (options.commandEntry?.isActive(update) ?? true) && (admission?.isCurrent(update) ?? true);
		if (!isCurrent()) return { success: false, reason: 'Command admission changed or expired' };
		if (updates.length === 0) {
			return { success: true };
		}

		const planner = updates.map((update) => this.composites?.get(update.property)).find(Boolean);
		if (planner || updates.some(isCoverControl))
			return this.dispatchComposite(updates, { ...options, isRequestCurrent: isCurrent }, admission);

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
			if (!isCurrent()) {
				this.failOwned(handles);
				return { success: false, reason: 'Command admission changed before dispatch' };
			}
			const canonicalUpdates =
				this.admissionGuards?.hasGuards?.() || options.isRequestCurrent
					? await this.canonicalOrdinaryUpdates(updates)
					: [...updates];
			if (!canonicalUpdates) {
				this.failOwned(handles);
				return { success: false, reason: 'Physical target changed before dispatch' };
			}
			const admissionUpdates = [...updates, ...canonicalUpdates];
			for (const update of admissionUpdates) {
				await options.commandEntry?.assertAllowed(update);
				await admission?.assertAllowed(update);
			}
			// Claimable providers use their prepared transport guard all the way through queued/retried I/O.
			let success: boolean;
			if (
				options.isRequestCurrent ||
				canonicalUpdates.some((update) => this.admissionGuards?.requiresGuardedDispatch?.(update))
			) {
				const byDevice = new Map<string, IDevicePropertyData[]>();
				for (const update of canonicalUpdates) {
					const batch = byDevice.get(update.device.id) ?? [];
					batch.push(update);
					byDevice.set(update.device.id, batch);
				}
				success = true;
				const deadline = Date.now() + (options.ttlMs ?? 3000);
				for (const batch of byDevice.values()) {
					const prepared = await this.platformRegistryService.get(batch[0].device)?.prepareCompositeBatch?.(batch);
					const guard = () =>
						isCurrent() &&
						admissionUpdates.every(isLeafCurrent) &&
						Date.now() < deadline &&
						!!prepared?.isCurrent() &&
						handles.every(
							(handle) => this.commandWindowService.peekGeneration(handle.canonicalPropertyId) === handle.generation,
						);
					if (!prepared || !guard() || !(await prepared.dispatch(guard))) {
						success = false;
						break;
					}
				}
			} else success = admissionUpdates.every(isLeafCurrent) && (await platform.processBatch([...updates]));

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

	private async canonicalOrdinaryUpdates(
		updates: readonly IDevicePropertyData[],
	): Promise<IDevicePropertyData[] | null> {
		const result: IDevicePropertyData[] = [];
		for (const update of updates) {
			const current = await this.propertyMetadata.findOne(update.property.id);
			if (!current) return null;
			const id = this.valueSourceRegistry.resolve(current);
			if (id !== this.valueSourceRegistry.resolve(update.property)) return null;
			const property = id === current.id ? current : await this.propertyMetadata.findOne(id);
			if (!property) return null;
			const channel =
				typeof property.channel === 'string' ? await this.channelsService.findOne(property.channel) : property.channel;
			const device =
				typeof channel?.device === 'string' ? await this.devicesService.findOne(channel.device) : channel?.device;
			if (!channel || !device) return null;
			const validation = validatePropertyCommandValue(property, update.value);
			if (!validation.valid || validation.value === undefined) return null;
			result.push({ property, channel, device, value: validation.value });
		}
		return result;
	}

	/** Composite commands reuse physical admission and exact generation readback, never aggregate equality. */
	private async dispatchComposite(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions,
		admission?: PropertyCommandAdmissionSnapshot,
	): Promise<PropertyCommandDispatchResult> {
		if (this.disposed || this.activeComposites >= 128)
			return { success: false, reason: 'Composite dispatcher unavailable or at capacity' };
		this.activeComposites++;
		try {
			return await this.executeComposite(updates, options, admission);
		} finally {
			this.activeComposites--;
		}
	}

	private async executeComposite(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions,
		admission?: PropertyCommandAdmissionSnapshot,
	): Promise<PropertyCommandDispatchResult> {
		if (options.commandEntry && !options.commandEntry.isActive())
			return { success: false, reason: 'Command entry snapshot expired or exceeded bounds' };
		const id = randomUUID();
		const deadline = Math.min(
			options.commandEntry?.deadlineAt ?? Infinity,
			options.deadlineAt ?? Infinity,
			Date.now() + Math.min(options.ttlMs ?? 10_000, 30_000),
		);
		if (Date.now() >= deadline) return { success: false, reason: 'Composite command deadline exceeded' };
		const planner = updates.map((update) => this.composites?.get(update.property)).find(Boolean);
		let plan: Awaited<ReturnType<typeof planner.plan>>;
		try {
			const metadataGeneration = planner ? 0 : this.propertyMetadata.getGeneration();
			if (!planner) {
				plan = {
					revision: metadataGeneration,
					children: updates.map((update) => ({ memberId: update.channel.id, update })),
					isCurrent: () => Promise.resolve(this.propertyMetadata.getGeneration() === metadataGeneration),
					isDispatchCurrent: () => this.propertyMetadata.getGeneration() === metadataGeneration,
				};
			} else {
				plan = await this.withCompositeDeadline(
					this.structureLock.runShared(() =>
						planner.plan(
							updates.filter((update) => planner.canHandle(update.property)),
							options.commandEntry,
						),
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
			}
		} catch (error) {
			return { success: false, reason: error instanceof Error ? error.message : 'Invalid composite plan' };
		}
		if (!plan.children.length || plan.children.length > 2048) {
			plan.dispose?.();
			return { success: false, reason: 'Composite size exceeds bounds' };
		}
		const outcomes: CompositeChildOutcome[] = plan.children.map((child) => ({
			memberId: child.memberId,
			memberIdentity: child.memberIdentity ?? child.update?.channel.id,
			propertyIdentity: child.propertyIdentity ?? child.update?.property.id ?? null,
			propertyId: child.update?.property.id ?? null,
			status: child.update ? 'accepted' : 'unavailable',
			reason: child.reason,
		}));
		const leaves = new Map<string, { update: IDevicePropertyData; indexes: number[] }>();
		const requestedValues = new Map<string, PropertyCommandValue>();
		// Resolve/normalize every canonical target before any physical I/O. One invalid leaf does not
		// suppress unrelated valid members, but contradictions reject the entire requested plan.
		for (const [index, child] of plan.children.entries()) {
			if (!child.update) continue;
			const canonical = this.valueSourceRegistry.resolve(child.update.property);
			if (Date.now() >= deadline) {
				Object.assign(outcomes[index], {
					status: 'timed_out',
					reason: 'Composite deadline exceeded during preparation',
				});
				continue;
			}
			let source: ChannelPropertyEntity | null;
			try {
				source = await this.withCompositeDeadline(this.propertyMetadata.findOne(canonical), deadline);
			} catch (error) {
				Object.assign(outcomes[index], {
					status: error instanceof CompositeDeadlineExceededError || Date.now() >= deadline ? 'timed_out' : 'failed',
					reason: error instanceof Error ? error.message : 'Metadata unavailable',
				});
				continue;
			}
			const validation = source ? validatePropertyCommandValue(source, child.update.value) : null;
			const targetValue = validation?.value ?? child.update.value;
			if (requestedValues.has(canonical) && requestedValues.get(canonical) !== targetValue) {
				const reason = 'Contradictory canonical targets in composite command';
				for (const outcome of outcomes)
					if (outcome.status === 'accepted') Object.assign(outcome, { status: 'failed', reason });
				const composite: CompositeCommandOutcome = { id, status: 'failed', children: outcomes };
				this.events?.emit('DevicesModule.CompositeCommand.Completed', {
					epoch: this.eventEpoch,
					sequence: ++this.eventSequence,
					...composite,
					children: composite.children.map(toEventChild),
					intentId: options.intentId,
					requestId: options.requestId,
					targets: updates.map(toTarget),
					revision: plan.revision,
				});
				plan.dispose?.();
				return { success: false, reason, composite };
			}
			requestedValues.set(canonical, targetValue);
			if (!validation?.valid || validation.value === undefined) {
				Object.assign(outcomes[index], {
					status: 'unavailable',
					reason: validation?.reason ?? 'Canonical property is missing',
				});
				continue;
			}
			const sourceChannel =
				typeof source.channel === 'string' ? await this.channelsService.findOne(source.channel) : source.channel;
			const sourceDeviceId =
				typeof sourceChannel?.device === 'string' ? sourceChannel.device : sourceChannel?.device?.id;
			const sourceDevice =
				sourceDeviceId === child.update.device.id
					? child.update.device
					: sourceDeviceId
						? await this.devicesService.findOne(sourceDeviceId)
						: null;
			if (!sourceChannel || !sourceDevice) {
				Object.assign(outcomes[index], { status: 'unavailable', reason: 'Canonical device/channel is missing' });
				continue;
			}
			const normalized: IDevicePropertyData = {
				device: sourceDevice,
				channel: sourceDevice.channels?.find((channel) => channel.id === sourceChannel.id) ?? sourceChannel,
				property: source,
				value: validation.value,
			};
			const existing = leaves.get(canonical);
			if (existing && existing.update.value !== normalized.value) {
				plan.dispose?.();
				return { success: false, reason: 'Contradictory canonical targets in composite command' };
			}
			if (existing) existing.indexes.push(index);
			else leaves.set(canonical, { update: normalized, indexes: [index] });
		}
		const channels = new Map<string, Array<{ update: IDevicePropertyData; indexes: number[] }>>();
		for (const leaf of leaves.values()) {
			const key = `${leaf.update.device.id}:${leaf.update.channel.id}`;
			const channel = channels.get(key) ?? [];
			channel.push(leaf);
			channels.set(key, channel);
		}
		const effectEpochs = new Map<string, string>();
		const releaseEffects = () => {
			for (const [scope, epoch] of effectEpochs) this.commandWindowService.releaseCoverEffect(scope, epoch);
		};
		const effectChannels = new Map<string, string>();
		for (const leaf of leaves.values())
			if (isCoverControl(leaf.update)) {
				const scope =
					this.platformRegistryService.get(leaf.update.device)?.getCoverEffectScope?.(leaf.update) ??
					leaf.update.channel.id;
				if (effectChannels.has(scope) && effectChannels.get(scope) !== leaf.update.channel.id) {
					plan.dispose?.();
					releaseEffects();
					return { success: false, reason: 'Multiple logical channels resolve to one physical cover motor' };
				}
				effectChannels.set(scope, leaf.update.channel.id);
				if (effectEpochs.has(scope)) continue;
				const epoch = this.commandWindowService.beginCoverEffect(scope);
				if (epoch === null) {
					plan.dispose?.();
					releaseEffects();
					return { success: false, reason: 'Cover effect capacity exceeded' };
				}
				effectEpochs.set(scope, epoch);
			}

		const effectsCurrent = () =>
			[...effectEpochs].every(([id, epoch]) => this.commandWindowService.isCoverEffectCurrent(id, epoch));
		const work = [...channels.values()];
		const preparedBatches = new Map<(typeof work)[number], PreparedCompositeDeviceBatch>();
		// Resolve every provider lease/target before any physical command starts. Preparation is
		// bounded independently so one hanging provider does not consume all normal group budget.
		let preparing = 0;
		await Promise.all(
			Array.from({ length: Math.min(8, work.length) }, async () => {
				while (preparing < work.length) {
					const channel = work[preparing++];
					try {
						const platform = this.platformRegistryService.get(channel[0].update.device);
						if (!platform) throw new Error('Unsupported physical platform');
						const requested = channel.map((leaf) => leaf.update);
						if (!platform.prepareCompositeBatch)
							throw new Error('Provider does not support the strict composite dispatch profile');
						const prepared = await this.withCompositeDeadline(
							platform.prepareCompositeBatch(requested),
							Math.min(deadline, Date.now() + 1_000),
						);
						if (!prepared || !prepared.isCurrent() || prepared.updates.length !== channel.length) {
							const readiness = await platform.getCommandReadiness?.(requested[0]);
							throw new Error(
								readiness?.reasons.join(', ') ||
									'Physical batch preparation is unavailable or changed target cardinality',
							);
						}
						const targets = new Map(
							prepared.updates.map((target) => [this.valueSourceRegistry.resolve(target.property), target]),
						);
						if (targets.size !== channel.length) throw new Error('Prepared physical targets are not distinct');
						for (const leaf of channel) {
							const target = targets.get(this.valueSourceRegistry.resolve(leaf.update.property));
							if (!target || target.device.id !== leaf.update.device.id || target.channel.id !== leaf.update.channel.id)
								throw new Error('Prepared physical target identity changed');
							const validation = validatePropertyCommandValue(target.property, target.value);
							if (!validation.valid || validation.value === undefined)
								throw new Error('Prepared physical target value is invalid');
							leaf.update = { ...target, value: validation.value };
							for (const index of leaf.indexes) outcomes[index].value = validation.value;
						}
						if (
							prepared.coverAction &&
							(!validCoverAction(
								prepared.coverAction,
								channel.map((leaf) => leaf.update),
							) ||
								prepared.coverAction.effectScope !== platform.getCoverEffectScope?.(channel[0].update))
						)
							throw new Error('Invalid cover observation footprint');
						preparedBatches.set(channel, prepared);
					} catch (error) {
						for (const leaf of channel)
							for (const index of leaf.indexes)
								Object.assign(outcomes[index], {
									status: 'unavailable',
									reason: error instanceof Error ? error.message : 'Physical preparation failed',
								});
					}
				}
			}),
		);
		let cursor = 0;
		let lastPublished = '';
		const publish = () => {
			const signature = JSON.stringify(outcomes);
			if (signature === lastPublished) return;
			lastPublished = signature;
			this.events?.emit('DevicesModule.CompositeCommand.Progress', {
				epoch: this.eventEpoch,
				sequence: ++this.eventSequence,
				id,
				intentId: options.intentId,
				requestId: options.requestId,
				targets: updates.map(toTarget),
				revision: plan.revision,
				deadlineAt: deadline,
				children: outcomes.map(toEventChild),
			});
		};
		const ownedGenerations = new Map<string, { generation: string; indexes: number[] }>();
		const observedConfirmations = new Map<string, string>();
		const channelSettlements = new Map<string, () => void>();
		const stopGenerations = this.commandWindowService.observeGeneration((propertyId, generation) => {
			const owned = ownedGenerations.get(propertyId);
			if (!owned || owned.generation === generation) return;
			for (const index of owned.indexes)
				if (['accepted', 'confirmed'].includes(outcomes[index].status))
					Object.assign(outcomes[index], {
						status: 'superseded',
						reason: 'Physical generation superseded or cancelled',
					});
			channelSettlements.get(propertyId)?.();
			publish();
		});
		const stopConfirmations = this.commandWindowService.observeConfirmation((handle) => {
			if (!leaves.has(handle.canonicalPropertyId)) return;
			observedConfirmations.set(handle.canonicalPropertyId, handle.generation);
			const owned = ownedGenerations.get(handle.canonicalPropertyId);
			if (!owned || owned.generation !== handle.generation) return;
			for (const index of owned.indexes)
				if (outcomes[index].status === 'accepted')
					Object.assign(outcomes[index], {
						status: 'confirmed',
						generation: handle.generation,
						reason: coverConfirmationReason(this.commandWindowService.get(handle.canonicalPropertyId)),
					});
			channelSettlements.get(handle.canonicalPropertyId)?.();
			publish();
		});
		const stopObserving = () => {
			stopGenerations();
			stopConfirmations();
		};
		const cleanup = () => {
			stopObserving();
			releaseEffects();
			for (const child of outcomes)
				if (child.status === 'accepted')
					Object.assign(child, { status: 'superseded', reason: 'Composite dispatcher stopped' });
			for (const [canonicalPropertyId, owned] of ownedGenerations)
				this.commandWindowService.fail({ canonicalPropertyId, generation: owned.generation });
			for (const signal of new Set(channelSettlements.values())) signal();
		};
		this.compositeCleanups.add(cleanup);
		publish();
		const workers = Array.from({ length: Math.min(8, work.length) }, async () => {
			while (cursor < work.length) {
				const channel = work[cursor++];
				const prepared = preparedBatches.get(channel);
				if (!prepared) continue;
				const setLeaf = (
					leaf: (typeof channel)[number],
					status: CompositeChildOutcome['status'],
					reason?: string,
					generation?: string,
				) => {
					if (status === 'confirmed')
						reason ??= coverConfirmationReason(
							this.commandWindowService.get(this.valueSourceRegistry.resolve(leaf.update.property)),
						);
					for (const index of leaf.indexes) Object.assign(outcomes[index], { status, reason, generation });
				};
				const setPending = (status: CompositeChildOutcome['status'], reason?: string) => {
					for (const leaf of channel)
						if (leaf.indexes.some((index) => outcomes[index].status === 'accepted')) setLeaf(leaf, status, reason);
					publish();
				};
				let handles: readonly PropertyCommandWindowHandle[] = [];
				let dispatchActive = true;
				try {
					if (this.disposed || Date.now() >= deadline) {
						setPending('timed_out');
						continue;
					}
					if (
						!effectsCurrent() ||
						!prepared.isCurrent() ||
						!(await this.withCompositeDeadline(plan.isCurrent(), deadline))
					) {
						setPending('superseded', 'Binding revision changed');
						continue;
					}
					// Check captured ownership for both requested aliases and prepared canonical leaves.
					const admissionUpdates = channel.flatMap((leaf) => [
						leaf.update,
						...leaf.indexes.flatMap((index) => (plan.children[index].update ? [plan.children[index].update] : [])),
					]);
					const effects: PropertyCommandEffect[] = (prepared.coverAction?.effects ?? []).map((property) => ({
						device: channel[0].update.device,
						channel: channel[0].update.channel,
						property,
						kind: 'cover_action',
						action: channel[0].update.value as 'open' | 'close' | 'stop',
					}));
					for (const effect of effects) {
						await options.commandEntry?.assertEffectAllowed(effect);
						await admission?.assertEffectAllowed?.(effect);
					}

					for (const update of admissionUpdates) {
						await options.commandEntry?.assertAllowed(update);
						await admission?.assertAllowed(update);
					}
					// Keep compound RGB/HS requests in the same prepared physical channel batch.
					const admitted = await this.withCompositeDeadline(
						this.admitWindows(
							channel.map((leaf) => leaf.update),
							{
								intentId: options.intentId,
								ttlMs: deadline - Date.now(),
								deadlineAt: deadline,
								requiresLiveEvidence: true,
							},
							new Map(
								channel.map((leaf) => [
									this.valueSourceRegistry.resolve(leaf.update.property),
									leaf.indexes.flatMap((index) =>
										plan.children[index].admissionCheck ? [plan.children[index].admissionCheck] : [],
									),
								]),
							),
							prepared.coverAction,
						),
						deadline,
					);
					handles = admitted?.map((window) => window.handle) ?? [];
					if (!admitted || handles.length !== channel.length) {
						setPending('unavailable', 'No correlated physical readback admission');
						continue;
					}
					if (
						handles.some(
							(handle) => this.commandWindowService.peekGeneration(handle.canonicalPropertyId) !== handle.generation,
						)
					) {
						setPending('superseded', 'Physical command generation replaced during compound admission');
						continue;
					}
					for (const leaf of channel) {
						const handle = handles.find(
							(handle) => handle.canonicalPropertyId === this.valueSourceRegistry.resolve(leaf.update.property),
						);
						ownedGenerations.set(handle.canonicalPropertyId, { generation: handle.generation, indexes: leaf.indexes });
						setLeaf(
							leaf,
							observedConfirmations.get(handle.canonicalPropertyId) === handle.generation ? 'confirmed' : 'accepted',
							undefined,
							handle.generation,
						);
					}
					publish();
					const allTerminal = () =>
						!channel.some((leaf) => leaf.indexes.some((index) => outcomes[index].status === 'accepted'));
					if (allTerminal()) continue;
					const settlement = new Promise<PropertyCommandDispatchResult>((resolve) => {
						const signal = () => {
							if (allTerminal()) resolve({ success: true });
						};
						for (const handle of handles) channelSettlements.set(handle.canonicalPropertyId, signal);
					});
					const dispatched = await this.withCompositeDeadline(
						Promise.race([
							settlement,

							this.dispatchPreparedComposite(
								channel.map((leaf) => leaf.update),
								handles,
								prepared,
								() =>
									dispatchActive &&
									effectsCurrent() &&
									!this.disposed &&
									effects.every(
										(effect) =>
											(options.commandEntry?.isEffectActive(effect) ?? true) &&
											(admission?.isEffectCurrent?.(effect) ?? !admission),
									) &&
									admissionUpdates.every(
										(update) =>
											(options.commandEntry?.isActive(update) ?? true) && (admission?.isCurrent(update) ?? true),
									) &&
									(options.isRequestCurrent?.() ?? true) &&
									Date.now() < deadline &&
									(plan.isDispatchCurrent?.() ?? true) &&
									handles.every(
										(handle) =>
											this.commandWindowService.peekGeneration(handle.canonicalPropertyId) === handle.generation,
									),
							),
						]),
						deadline,
					);
					if (!dispatched.success) {
						if (prepared.isCurrent() && (plan.isDispatchCurrent?.() ?? true))
							for (const leaf of channel) {
								const handle = handles.find(
									(handle) => handle.canonicalPropertyId === this.valueSourceRegistry.resolve(leaf.update.property),
								);
								const window = this.commandWindowService.get(handle.canonicalPropertyId);
								if (window?.generation === handle.generation && window.state === 'confirmed_grace')
									setLeaf(leaf, 'confirmed', undefined, handle.generation);
							}
						setPending(
							!prepared.isCurrent() ? 'superseded' : Date.now() >= deadline ? 'timed_out' : 'failed',
							dispatched.reason,
						);
						continue;
					}
					while (!this.disposed && Date.now() < deadline) {
						if (
							!effectsCurrent() ||
							!prepared.isCurrent() ||
							!(await this.withCompositeDeadline(plan.isCurrent(), deadline))
						) {
							setPending('superseded', 'Binding revision changed');
							break;
						}
						for (const leaf of channel) {
							if (!leaf.indexes.some((index) => outcomes[index].status === 'accepted')) continue;
							const handle = handles.find(
								(handle) => handle.canonicalPropertyId === this.valueSourceRegistry.resolve(leaf.update.property),
							);
							const window = this.commandWindowService.get(handle.canonicalPropertyId);
							if (!window || window.generation !== handle.generation)
								setLeaf(leaf, 'superseded', 'Physical command generation replaced');
							else if (window.state === 'confirmed_grace') setLeaf(leaf, 'confirmed', undefined, handle.generation);
						}
						publish();
						if (!channel.some((leaf) => leaf.indexes.some((index) => outcomes[index].status === 'accepted'))) break;
						await new Promise<void>((resolve) => setTimeout(resolve, Math.min(20, Math.max(1, deadline - Date.now()))));
					}
					setPending('timed_out');
				} catch (error) {
					setPending(
						error instanceof CompositeAdmissionSnapshotChangedError
							? 'superseded'
							: error instanceof CompositeDeadlineExceededError || Date.now() >= deadline
								? 'timed_out'
								: 'failed',
						error instanceof Error ? error.message : 'Execution failed',
					);
				} finally {
					dispatchActive = false;
					prepared.dispose?.();
					for (const handle of handles) channelSettlements.delete(handle.canonicalPropertyId);
					for (const leaf of channel)
						if (leaf.indexes.some((index) => outcomes[index].status !== 'confirmed'))
							this.failOwned(
								handles.filter(
									(handle) => handle.canonicalPropertyId === this.valueSourceRegistry.resolve(leaf.update.property),
								),
							);
				}
			}
		});
		try {
			await Promise.all(workers);
			let current = true;
			if (Date.now() < deadline) {
				try {
					current = await this.withCompositeDeadline(plan.isCurrent(), deadline);
				} catch {
					current = false;
				}
			}
			if (!current)
				for (const child of outcomes)
					if (child.status === 'confirmed')
						Object.assign(child, { status: 'superseded', reason: 'Binding revision changed before parent completion' });
			const confirmed = outcomes.filter((child) => child.status === 'confirmed').length;
			const composite: CompositeCommandOutcome = {
				id,
				status: confirmed === outcomes.length ? 'confirmed' : confirmed > 0 ? 'partial' : 'failed',
				children: outcomes.map((child) => ({ ...child })),
			};
			this.events?.emit('DevicesModule.CompositeCommand.Completed', {
				epoch: this.eventEpoch,
				sequence: ++this.eventSequence,
				...composite,
				children: composite.children.map(toEventChild),
				intentId: options.intentId,
				requestId: options.requestId,
				targets: updates.map(toTarget),
				revision: plan.revision,
			});
			return {
				success: composite.status === 'confirmed',
				composite,
				reason: composite.status === 'confirmed' ? undefined : `Composite command ${composite.status}`,
			};
		} finally {
			stopObserving();
			this.compositeCleanups.delete(cleanup);
			releaseEffects();
			plan.dispose?.();
		}
	}
	private async dispatchPreparedComposite(
		updates: readonly IDevicePropertyData[],
		handles: readonly PropertyCommandWindowHandle[],
		prepared: PreparedCompositeDeviceBatch,
		isAdmitted: () => boolean,
	): Promise<PropertyCommandDispatchResult> {
		if (
			this.disposed ||
			!prepared.isCurrent() ||
			!(await this.verifyPreopenedWindows(updates, handles, prepared.coverAction))
		)
			return { success: false, reason: 'Prepared provider target changed before dispatch' };
		const action = prepared.coverAction;
		const context =
			action && validCoverAction(action, updates)
				? coverActionContext(
						action,
						updates[0],
						handles[0],
						this.commandWindowService,
						this.propertyValues,
						() => isAdmitted() && prepared.isCurrent(),
					)
				: undefined;
		const success = await prepared.dispatch(isAdmitted, context);
		return success ? { success: true } : { success: false, reason: 'Execution failed' };
	}

	private async withCompositeDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
		let timer: NodeJS.Timeout;
		try {
			return await Promise.race([
				operation,
				new Promise<T>((_, reject) => {
					timer = setTimeout(
						() => reject(new CompositeDeadlineExceededError('Composite deadline exceeded')),
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
		if (isCoverControl(update)) return null;
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
		checks?: ReadonlyMap<string, readonly (() => boolean)[]>,
		cover?: PreparedCoverAction,
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
				let admission: WindowAdmission | null;
				try {
					admission = await this.propertyStateCoordinator.run(canonicalPropertyId, () =>
						this.createAdmission(canonicalPropertyId, requestedUpdates, cover),
					);
				} catch (error) {
					this.failOwned(admitted.map(({ handle }) => handle));
					throw error;
				}

				if (admission === null) {
					this.failOwned(admitted.map(({ handle }) => handle));

					return null;
				}

				if (
					this.disposed ||
					!(options.commandEntry?.isActive() ?? true) ||
					!(options.isRequestCurrent?.() ?? true) ||
					(options.deadlineAt !== undefined && Date.now() >= options.deadlineAt)
				) {
					this.failOwned(admitted.map(({ handle }) => handle));
					return null;
				}
				if (!admission.eligible) {
					continue;
				}

				if (checks?.get(canonicalPropertyId)?.some((check) => !check())) {
					this.failOwned(admitted.map(({ handle }) => handle));
					throw new CompositeAdmissionSnapshotChangedError('Preserved power snapshot changed before admission');
				}
				const handle = this.commandWindowService.open({
					canonicalTarget: admission.canonicalTarget,
					requestedTargets: admission.requestedTargets,
					intentId: options.intentId,
					commandedValue: admission.commandedValue,
					requiresLiveEvidence: options.requiresLiveEvidence,
					proofKind: cover ? 'cover_action' : undefined,
					effectScope: admission.effectScope,
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
		cover?: PreparedCoverAction,
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

		for (const requested of requestedUpdates) await this.admissionGuards?.assertAllowed(requested);
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
			eligible: (writable && !authoritative) || validCoverAction(cover, requestedUpdates),
			effectScope: isCoverControl(first)
				? (this.platformRegistryService.get(sourceDevice)?.getCoverEffectScope?.(first) ?? sourceChannel.id)
				: undefined,
		};
	}

	/** Revalidates a receipt's requested alias/source identity before platform I/O without opening another generation. */
	private async verifyPreopenedWindows(
		updates: readonly IDevicePropertyData[],
		handles: readonly PropertyCommandWindowHandle[],
		cover?: PreparedCoverAction,
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
					this.createAdmission(canonicalPropertyId, requestedUpdates, cover),
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

const toEventChild = (child: CompositeChildOutcome) => ({
	member_id: child.memberId,
	property_id: child.propertyId,
	member_identity: child.memberIdentity,
	property_identity: child.propertyIdentity,
	status: child.status,
	reason: child.reason,
	value: child.value,
	generation: child.generation,
});

const toTarget = ({
	device,
	channel,
	property,
}: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): PropertyCommandWindowTarget => ({
	deviceId: device.id,
	channelId: channel.id,
	propertyId: property.id,
});
