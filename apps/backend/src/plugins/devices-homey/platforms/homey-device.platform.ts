import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	DEVICES_HOMEY_TYPE,
	HOMEY_COMMAND_MAX_DURATION_MS,
} from '../devices-homey.constants';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { type HomeyWriteStrategy } from '../mappings/mapping.types';
import { HomeyCapability, HomeyCapabilityValue } from '../models/homey-capability.model';
import { HomeyFailureLogLimiter } from '../services/homey-failure-log-limiter';
import { HomeyService } from '../services/homey.service';

import { validateHomeyCapabilityCommandValue } from './homey-command-value';

export type HomeyDevicePropertyData = IDevicePropertyData & {
	device: HomeyDeviceEntity;
	channel: HomeyChannelEntity;
	property: HomeyChannelPropertyEntity;
};

interface PreparedHomeyCommand {
	readonly deviceId: string;
	readonly capability: HomeyCapability;
	readonly capabilityId: string;
	readonly value: HomeyCapabilityValue;
}

interface PreparedThermostatModeUpdate {
	readonly deviceId: string;
	readonly capabilityId: string;
	readonly writeStrategy: HomeyWriteStrategy;
	readonly value: boolean;
}

interface PreparedThermostatModeCommand {
	readonly deviceId: string;
	readonly capabilityId: string;
	readonly updates: readonly PreparedThermostatModeUpdate[];
}

const THERMOSTAT_TARGET_MAPPINGS = new Set([
	'thermostat-heater-target-temperature',
	'thermostat-cooler-target-temperature',
]);

export interface HomeyThermostatModeStates {
	readonly heaterOn: boolean;
	readonly coolerOn: boolean;
}

export const homeyThermostatModeToStates = (value: HomeyCapabilityValue): HomeyThermostatModeStates | null => {
	switch (value) {
		case 'off':
			return { heaterOn: false, coolerOn: false };
		case 'heat':
			return { heaterOn: true, coolerOn: false };
		case 'cool':
			return { heaterOn: false, coolerOn: true };
		case 'auto':
		case 'heat_cool':
			return { heaterOn: true, coolerOn: true };
		default:
			return null;
	}
};

export const homeyThermostatStatesToMode = (
	capability: HomeyCapability,
	heaterOn: boolean,
	coolerOn: boolean,
): HomeyCapabilityValue => {
	if (heaterOn && coolerOn) {
		const supportedModes = new Set(capability.enumValues.map((value) => value.id));

		if (supportedModes.has('auto')) {
			return 'auto';
		}

		return supportedModes.has('heat_cool') ? 'heat_cool' : null;
	}

	if (heaterOn) {
		return 'heat';
	}

	return coolerOn ? 'cool' : 'off';
};

@Injectable()
export class HomeyDevicePlatform implements IDevicePlatform {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'DevicePlatform');
	private readonly failureLogLimiter = new HomeyFailureLogLimiter();

	constructor(
		private readonly homeyService: HomeyService,
		private readonly mappingLoader: HomeyMappingLoaderService,
		private readonly transformer: HomeyMappingTransformerService,
	) {}

	getType(): string {
		return DEVICES_HOMEY_TYPE;
	}

	getCommandTimeoutMs(commandCount: number): number {
		return Math.max(0, commandCount) * HOMEY_COMMAND_MAX_DURATION_MS;
	}

	usesAuthoritativePropertyReadback(property: ChannelPropertyEntity): boolean {
		if (
			!(property instanceof HomeyChannelPropertyEntity) ||
			typeof property.homeyCapabilityId !== 'string' ||
			typeof property.homeyMappingName !== 'string'
		) {
			return false;
		}

		const mapping = this.mappingLoader
			.getPropertyMappings()
			.find((candidate) => candidate.name === property.homeyMappingName);

		return mapping !== undefined && mapping.property.direction !== 'write_only';
	}

	process(update: HomeyDevicePropertyData): Promise<boolean> {
		return this.processBatch([update]);
	}

	prepareBatch(updates: HomeyDevicePropertyData[]): HomeyDevicePropertyData[] | null {
		const prepared = updates.map((update) => ({ ...update }));
		const inventory = this.homeyService.getInventorySnapshot();

		if (inventory === null) {
			return prepared;
		}

		const upstreamDevices = new Map(inventory.map((device) => [device.id, device]));
		const groupedTargetIndexes = new Map<string, number[]>();

		for (const [index, update] of prepared.entries()) {
			if (
				!(update.device instanceof HomeyDeviceEntity) ||
				!(update.property instanceof HomeyChannelPropertyEntity) ||
				typeof update.device.identifier !== 'string' ||
				typeof update.property.homeyCapabilityId !== 'string' ||
				typeof update.property.homeyMappingName !== 'string' ||
				!THERMOSTAT_TARGET_MAPPINGS.has(update.property.homeyMappingName)
			) {
				continue;
			}

			const key = `${update.device.identifier}\u0000${update.property.homeyCapabilityId}`;
			const group = groupedTargetIndexes.get(key) ?? [];
			group.push(index);
			groupedTargetIndexes.set(key, group);
		}

		for (const [key, indexes] of groupedTargetIndexes) {
			const separator = key.indexOf('\u0000');
			const deviceId = key.slice(0, separator);
			const capabilityId = key.slice(separator + 1);
			const capability = upstreamDevices.get(deviceId)?.capabilities.find((candidate) => candidate.id === capabilityId);
			const values = indexes.map((index) => {
				const update = prepared[index];

				if (update === undefined) {
					return null;
				}

				return this.validateThermostatTargetInput(update.property, update.value);
			});

			if (capability === undefined || values.some((value) => value === null)) {
				return null;
			}

			const numericValues = values.filter((value): value is number => value !== null);
			const requestedTarget =
				numericValues.length === 1 ? numericValues[0] : (Math.min(...numericValues) + Math.max(...numericValues)) / 2;
			const projected = this.alignThermostatTargetToCapability(capability, requestedTarget);

			if (projected === null) {
				return null;
			}

			for (const index of indexes) {
				const update = prepared[index];

				if (update === undefined || !validatePropertyCommandValue(update.property, projected).valid) {
					return null;
				}

				prepared[index] = { ...prepared[index], value: projected };
			}

			const first = prepared[indexes[0]];

			if (!(first?.device instanceof HomeyDeviceEntity)) {
				return null;
			}

			const preparedPropertyIds = new Set(prepared.map((update) => update.property.id));

			for (const channel of first.device.channels ?? []) {
				if (!(channel instanceof HomeyChannelEntity)) {
					continue;
				}

				for (const property of channel.properties ?? []) {
					if (
						property instanceof HomeyChannelPropertyEntity &&
						property.homeyCapabilityId === capabilityId &&
						typeof property.homeyMappingName === 'string' &&
						THERMOSTAT_TARGET_MAPPINGS.has(property.homeyMappingName) &&
						!preparedPropertyIds.has(property.id)
					) {
						if (!validatePropertyCommandValue(property, projected).valid) {
							return null;
						}

						prepared.push({ device: first.device, channel, property, value: projected });
						preparedPropertyIds.add(property.id);
					}
				}
			}
		}

		return prepared;
	}

	async processBatch(updates: HomeyDevicePropertyData[]): Promise<boolean> {
		if (updates.length === 0) {
			return true;
		}

		const preparedUpdates = this.prepareBatch(updates);

		if (preparedUpdates === null) {
			this.logCommandFailure('thermostat-target-invalid', 'Homey shared thermostat target projection failed');

			return false;
		}

		const inventory = this.homeyService.getInventorySnapshot();

		if (inventory === null) {
			this.logCommandFailure('inventory-unavailable', 'Homey inventory is unavailable for command validation');

			return false;
		}

		const upstreamDevices = new Map(inventory.map((device) => [device.id, device]));
		const commands: PreparedHomeyCommand[] = [];
		const thermostatModeUpdates: PreparedThermostatModeUpdate[] = [];
		const thermostatTargetCommands: PreparedHomeyCommand[] = [];

		for (const update of preparedUpdates) {
			const { device, channel, property, value } = update;

			if (
				!(device instanceof HomeyDeviceEntity) ||
				!(channel instanceof HomeyChannelEntity) ||
				!(property instanceof HomeyChannelPropertyEntity) ||
				!device.enabled ||
				typeof device.identifier !== 'string' ||
				typeof property.homeyCapabilityId !== 'string' ||
				typeof property.homeyMappingName !== 'string' ||
				!this.referencesEntity(channel.device, device.id) ||
				!this.referencesEntity(property.channel, channel.id) ||
				!property.permissions.some((permission) =>
					[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
				)
			) {
				this.logCommandFailure('target-invalid', 'Homey command target is incomplete or disabled');

				return false;
			}

			const upstreamDevice = upstreamDevices.get(device.identifier);

			if (upstreamDevice === undefined || !upstreamDevice.available) {
				this.logCommandFailure('target-unavailable', 'Homey command target is unavailable');

				return false;
			}

			const capability = upstreamDevice.capabilities.find((candidate) => candidate.id === property.homeyCapabilityId);
			const binding = this.mappingLoader
				.resolvePropertyMappings(upstreamDevice)
				.mappings.find(
					(candidate) =>
						candidate.capabilityId === property.homeyCapabilityId &&
						candidate.mapping.name === property.homeyMappingName,
				);
			const mapping = binding?.mapping;

			if (
				capability === undefined ||
				mapping === undefined ||
				!mapping.match.capabilityBaseIds.includes(capability.baseId) ||
				mapping.property.channel !== channel.identifier ||
				mapping.property.category !== property.category ||
				mapping.property.direction === 'read_only'
			) {
				this.logCommandFailure('mapping-unavailable', 'Homey command mapping is unavailable or stale');

				return false;
			}

			const panelValidation = validatePropertyCommandValue(property, value);

			if (!panelValidation.valid || panelValidation.value === undefined) {
				this.logCommandFailure('panel-value-invalid', 'Homey panel command value is invalid');

				return false;
			}

			if (mapping.property.writeStrategy !== undefined) {
				if (typeof panelValidation.value !== 'boolean') {
					this.logCommandFailure('panel-value-invalid', 'Homey thermostat mode command value is invalid');

					return false;
				}

				thermostatModeUpdates.push({
					deviceId: upstreamDevice.id,
					capabilityId: capability.id,
					writeStrategy: mapping.property.writeStrategy,
					value: panelValidation.value,
				});

				continue;
			}

			let transformed: HomeyCapabilityValue;

			try {
				transformed = this.transformer.write(mapping, panelValidation.value);
			} catch {
				this.logCommandFailure('transformation-failed', 'Homey command transformation failed');

				return false;
			}

			if (!validateHomeyCapabilityCommandValue(capability, transformed).valid) {
				this.logCommandFailure('transformed-value-invalid', 'Homey transformed command value is invalid');

				return false;
			}

			const command = {
				deviceId: upstreamDevice.id,
				capability,
				capabilityId: capability.id,
				value: transformed,
			};

			if (THERMOSTAT_TARGET_MAPPINGS.has(mapping.name)) {
				thermostatTargetCommands.push(command);
			} else {
				commands.push(command);
			}
		}

		const thermostatModeCommands = this.groupThermostatModeCommands(thermostatModeUpdates);
		const coalescedThermostatTargets = this.coalesceThermostatTargetCommands(thermostatTargetCommands);

		if (coalescedThermostatTargets === null) {
			return false;
		}

		for (const command of commands) {
			if (!(await this.homeyService.executeCapabilityCommand(command.deviceId, command.capabilityId, command.value))) {
				return false;
			}
		}

		for (const command of thermostatModeCommands) {
			if (
				!(await this.homeyService.executeDerivedCapabilityCommand(
					command.deviceId,
					command.capabilityId,
					(capability) => this.deriveThermostatModeValue(capability, command.updates),
				))
			) {
				return false;
			}
		}

		for (const command of coalescedThermostatTargets) {
			if (!(await this.homeyService.executeCapabilityCommand(command.deviceId, command.capabilityId, command.value))) {
				return false;
			}
		}

		return true;
	}

	private groupThermostatModeCommands(
		updates: readonly PreparedThermostatModeUpdate[],
	): PreparedThermostatModeCommand[] {
		const groups = new Map<string, PreparedThermostatModeUpdate[]>();

		for (const update of updates) {
			const key = `${update.deviceId}\u0000${update.capabilityId}`;
			const group = groups.get(key) ?? [];
			group.push(update);
			groups.set(key, group);
		}

		return [...groups.values()].map((group) => ({
			deviceId: group[0].deviceId,
			capabilityId: group[0].capabilityId,
			updates: group,
		}));
	}

	private deriveThermostatModeValue(
		capability: HomeyCapability,
		updates: readonly PreparedThermostatModeUpdate[],
	): HomeyCapabilityValue | undefined {
		const current = homeyThermostatModeToStates(capability.value);
		let heaterOn = current?.heaterOn;
		let coolerOn = current?.coolerOn;

		for (const update of updates) {
			if (update.writeStrategy === 'thermostat_heater_mode') {
				heaterOn = update.value;
			} else if (update.writeStrategy === 'thermostat_cooler_mode') {
				coolerOn = update.value;
			}
		}

		if (heaterOn === undefined || coolerOn === undefined) {
			this.logCommandFailure(
				'thermostat-mode-unavailable',
				'Homey thermostat mode cannot be combined with an unknown current mode',
			);

			return undefined;
		}

		const mode = homeyThermostatStatesToMode(capability, heaterOn, coolerOn);

		if (mode === null || !validateHomeyCapabilityCommandValue(capability, mode).valid) {
			this.logCommandFailure(
				'thermostat-mode-unsupported',
				'Homey thermostat does not support the requested configured mode',
			);

			return undefined;
		}

		return mode;
	}

	private coalesceThermostatTargetCommands(commands: readonly PreparedHomeyCommand[]): PreparedHomeyCommand[] | null {
		const grouped = new Map<string, PreparedHomeyCommand[]>();

		for (const command of commands) {
			const key = `${command.deviceId}\u0000${command.capabilityId}`;
			const group = grouped.get(key) ?? [];
			group.push(command);
			grouped.set(key, group);
		}

		const selected: PreparedHomeyCommand[] = [];

		for (const group of grouped.values()) {
			const first = group[0];

			if (group.length === 1) {
				selected.push(first);
				continue;
			}

			const values = group.map((command) => command.value);

			if (values.some((value) => typeof value !== 'number')) {
				this.logCommandFailure(
					'thermostat-target-invalid',
					'Homey shared thermostat target requires numeric setpoint values',
				);

				return null;
			}

			const numericValues = values as number[];
			const midpoint = (Math.min(...numericValues) + Math.max(...numericValues)) / 2;
			const projected = this.alignThermostatTargetToCapability(first.capability, midpoint);

			if (projected === null) {
				this.logCommandFailure(
					'thermostat-target-invalid',
					'Homey shared thermostat target cannot represent the requested setpoint midpoint',
				);

				return null;
			}

			selected.push({ ...first, value: projected });
		}

		return selected;
	}

	private validateThermostatTargetInput(property: HomeyChannelPropertyEntity, value: unknown): number | null {
		const propertyWithoutGrid = Object.assign(new HomeyChannelPropertyEntity(), property, { step: null });
		const validation = validatePropertyCommandValue(propertyWithoutGrid, value);

		return validation.valid && typeof validation.value === 'number' ? validation.value : null;
	}

	private alignThermostatTargetToCapability(capability: HomeyCapability, value: number): number | null {
		let aligned = value;

		if (capability.step !== null) {
			const base = capability.minimum ?? 0;
			aligned = base + Math.round((value - base) / capability.step) * capability.step;
		}

		if (capability.minimum !== null) {
			aligned = Math.max(capability.minimum, aligned);
		}

		if (capability.maximum !== null) {
			aligned = Math.min(capability.maximum, aligned);
		}

		aligned = Number(aligned.toPrecision(15));

		return validateHomeyCapabilityCommandValue(capability, aligned).valid ? aligned : null;
	}

	private referencesEntity(reference: { readonly id: string } | string, expectedId: string): boolean {
		return (typeof reference === 'string' ? reference : reference.id) === expectedId;
	}

	private logCommandFailure(key: string, message: string): void {
		const decision = this.failureLogLimiter.consume(key);

		if (decision.log) {
			this.logger.warn(message, { suppressed: decision.suppressed });
		}
	}
}
