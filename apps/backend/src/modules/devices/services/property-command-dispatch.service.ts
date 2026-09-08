import { Injectable } from '@nestjs/common';

import { PermissionType } from '../devices.constants';
import { PropertyValueState } from '../models/property-value-state.model';
import { IDevicePropertyData } from '../platforms/device.platform';
import { PropertyCommandValue, validatePropertyCommandValue } from '../utils/property-command-value.utils';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import {
	PropertyCommandWindowHandle,
	PropertyCommandWindowService,
	PropertyCommandWindowTarget,
} from './property-command-window.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';

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
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsService: ChannelsService,
		private readonly devicesService: DevicesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly structureLock: DeviceStructureLockService,
		private readonly propertyStateCoordinator: PropertyStateCoordinatorService,
		private readonly commandWindowService: PropertyCommandWindowService,
	) {}

	async dispatchBatch(
		updates: readonly IDevicePropertyData[],
		options: PropertyCommandDispatchOptions = {},
	): Promise<PropertyCommandDispatchResult> {
		if (updates.length === 0) {
			return { success: true };
		}

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

				admitted.push({
					handle: this.commandWindowService.open({
						canonicalTarget: admission.canonicalTarget,
						requestedTargets: admission.requestedTargets,
						intentId: options.intentId,
						commandedValue: admission.commandedValue,
						previousValue: admission.previousValue,
						ttlMs: options.ttlMs ?? 3_000,
					}),
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

		// Every requested alias is reloaded while the lifecycle barrier is held. A remap is never
		// silently authorized as a command to a different source between validation and forwarding.
		for (const requested of requestedUpdates) {
			const currentRequested = await this.channelsPropertiesService.findOne(requested.property.id);

			if (currentRequested === null || this.valueSourceRegistry.resolve(currentRequested) !== canonicalPropertyId) {
				return null;
			}
		}

		const sourceProperty = await this.channelsPropertiesService.findOne(canonicalPropertyId);

		if (sourceProperty === null || this.valueSourceRegistry.resolve(sourceProperty) !== sourceProperty.id) {
			return null;
		}

		const sourceChannelId = getEntityId(sourceProperty.channel);
		const sourceChannel = sourceChannelId === null ? null : await this.channelsService.findOne(sourceChannelId);
		const sourceDeviceId = sourceChannel === null ? null : getEntityId(sourceChannel.device);
		const sourceDevice = sourceDeviceId === null ? null : await this.devicesService.findOne(sourceDeviceId);

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

		const requestedTargets = requestedUpdates.map(toTarget);
		const canonicalTarget = toTarget({ device: sourceDevice, channel: sourceChannel, property: sourceProperty });
		const writable = sourceProperty.permissions.includes(PermissionType.READ_WRITE);
		const authoritative = this.platformRegistryService.usesAuthoritativePropertyReadback(sourceDevice, sourceProperty);

		return {
			canonicalPropertyId,
			canonicalTarget,
			requestedTargets,
			commandedValue,
			previousValue: sourceProperty.value?.value ?? null,
			baseline:
				sourceProperty.value === null
					? null
					: new PropertyValueState(
							sourceProperty.value.value,
							sourceProperty.value.lastUpdated,
							sourceProperty.value.trend,
						),
			eligible: writable && !authoritative,
		};
	}

	/** Revalidates a receipt's requested alias/source identity before platform I/O without opening another generation. */
	private async verifyPreopenedWindows(
		updates: readonly IDevicePropertyData[],
		handles: readonly PropertyCommandWindowHandle[],
	): Promise<boolean> {
		return this.structureLock.runShared(async () => {
			for (const update of updates) {
				const current = await this.channelsPropertiesService.findOne(update.property.id);
				if (current === null) {
					return false;
				}

				const canonicalPropertyId = this.valueSourceRegistry.resolve(current);
				const handle = handles.find((candidate) => candidate.canonicalPropertyId === canonicalPropertyId);
				const window = handle === undefined ? null : this.commandWindowService.get(canonicalPropertyId);

				if (window === null || handle === undefined || window.generation !== handle.generation) {
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

const getEntityId = <T extends { id: string }>(entity: T | string | null | undefined): string | null =>
	typeof entity === 'string' ? entity : (entity?.id ?? null);

const toTarget = ({
	device,
	channel,
	property,
}: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): PropertyCommandWindowTarget => ({
	deviceId: device.id,
	channelId: channel.id,
	propertyId: property.id,
});
