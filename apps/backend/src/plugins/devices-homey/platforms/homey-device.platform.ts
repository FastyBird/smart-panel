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
import { HomeyCapabilityValue } from '../models/homey-capability.model';
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
	readonly capabilityId: string;
	readonly value: HomeyCapabilityValue;
}

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

	async processBatch(updates: HomeyDevicePropertyData[]): Promise<boolean> {
		if (updates.length === 0) {
			return true;
		}

		const inventory = this.homeyService.getInventorySnapshot();

		if (inventory === null) {
			this.logCommandFailure('inventory-unavailable', 'Homey inventory is unavailable for command validation');

			return false;
		}

		const upstreamDevices = new Map(inventory.map((device) => [device.id, device]));
		const commands: PreparedHomeyCommand[] = [];

		for (const update of updates) {
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

			commands.push({
				deviceId: upstreamDevice.id,
				capabilityId: capability.id,
				value: transformed,
			});
		}

		for (const command of commands) {
			if (!(await this.homeyService.executeCapabilityCommand(command.deviceId, command.capabilityId, command.value))) {
				return false;
			}
		}

		return true;
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
