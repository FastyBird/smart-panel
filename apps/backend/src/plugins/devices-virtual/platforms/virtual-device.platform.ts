import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

@Injectable()
export class VirtualDevicePlatform implements IDevicePlatform {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDevicePlatform');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	getType(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	async process(data: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([data]);
	}

	async processBatch(updates: IDevicePropertyData[]): Promise<boolean> {
		// `enabled` is enforced here rather than upstream because that is where every other device
		// plugin enforces it — devices-shelly-v1, devices-wled and devices-zigbee2mqtt each open
		// processBatch() with the same check. PropertyCommandService only tests connection state
		// (`device.status.online`), never `enabled`, so without this a disabled virtual device
		// resolves its sources and forwards every command exactly as an enabled one does.
		//
		// Checked across the whole batch and before a single source is resolved, so a disabled device
		// never partially applies — the same all-or-nothing discipline as the platform-resolution
		// pre-pass below. `find` rather than `updates[0]` because an empty batch has no first element.
		const disabled = updates.find((update) => !update.device.enabled);

		if (disabled) {
			this.logger.warn(`Virtual device id=${disabled.device.id} is disabled, refusing to forward`);

			return false;
		}

		const bySourceDevice = new Map<string, { device: DeviceEntity; updates: IDevicePropertyData[] }>();

		for (const update of updates) {
			const property = update.property;

			if (!(property instanceof VirtualChannelPropertyEntity)) {
				this.logger.error(`Property id=${property.id} is not a virtual property`);

				return false;
			}

			// Owned properties are read-only in this release — the only ones that exist are the
			// synthesized device information strings. Writable setpoints arrive with controller support.
			if (property.valueOrigin === VirtualValueOrigin.LOCAL) {
				this.logger.warn(`Property id=${property.id} is owned and not writable`);

				return false;
			}

			if (property.sourcePropertyId === null) {
				this.logger.warn(`Property id=${property.id} has no source, it was deleted`);

				return false;
			}

			const resolved = await this.resolveSource(property.sourcePropertyId);

			if (!resolved) {
				return false;
			}

			const { device, channel, property: sourceProperty } = resolved;

			// Nesting is rejected at creation (SourceNotVirtualConstraintValidator, on `source_property` in
			// the create/update channel-property DTOs); this is the backstop against a stale or hand-edited row.
			if (device.type === DEVICES_VIRTUAL_TYPE) {
				this.logger.error(`Source device id=${device.id} is itself virtual, refusing to forward`);

				return false;
			}

			if (!device.status.online && device.status.status !== ConnectionState.UNKNOWN) {
				this.logger.warn(`Source device id=${device.id} is offline`);

				return false;
			}

			const group = bySourceDevice.get(device.id) ?? { device, updates: [] };

			group.updates.push({ device, channel, property: sourceProperty, value: update.value });

			bySourceDevice.set(device.id, group);
		}

		// Resolve every group's platform before forwarding to any of them. PlatformRegistryService.get()
		// is a pure synchronous lookup with no I/O, so this pre-pass costs nothing and guarantees a
		// "no platform registered" failure can never happen after an earlier group has already forwarded.
		const forwardTargets: Array<{ device: DeviceEntity; platform: IDevicePlatform; updates: IDevicePropertyData[] }> =
			[];

		for (const { device, updates: sourceUpdates } of bySourceDevice.values()) {
			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.logger.warn(`No platform registered for source device id=${device.id} type=${device.type}`);

				return false;
			}

			forwardTargets.push({ device, platform, updates: sourceUpdates });
		}

		// Past this point every group has a resolved platform, but a batch spanning several source
		// devices is still not atomic: IDevicePlatform has no pre-flight/dry-run hook, so there is no
		// way to check that a later group would succeed before an earlier group's processBatch has
		// already moved real hardware. If a later group legitimately fails, this returns false for the
		// whole batch even though earlier groups already forwarded — accepted, not fixed, because adding
		// such a hook would change a contract shared by eight plugins.
		for (const { device, platform, updates: sourceUpdates } of forwardTargets) {
			const success = await platform.processBatch(sourceUpdates);

			if (!success) {
				this.logger.error(`Forwarded batch failed for source device id=${device.id}`);

				return false;
			}
		}

		return true;
	}

	private async resolveSource(
		sourcePropertyId: string,
	): Promise<{ device: DeviceEntity; channel: ChannelEntity; property: ChannelPropertyEntity } | null> {
		const property = await this.channelsPropertiesService.findOne(sourcePropertyId);

		if (!property) {
			this.logger.warn(`Source property id=${sourcePropertyId} not found`);

			return null;
		}

		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		const channel = channelId ? await this.channelsService.findOne(channelId) : null;

		if (!channel) {
			this.logger.warn(`Source channel for property id=${sourcePropertyId} not found`);

			return null;
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const device = deviceId ? await this.devicesService.findOne(deviceId) : null;

		if (!device) {
			this.logger.warn(`Source device for property id=${sourcePropertyId} not found`);

			return null;
		}

		return { device, channel, property };
	}
}
