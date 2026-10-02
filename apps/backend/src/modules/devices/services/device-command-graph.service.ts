import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceConnectionStatus, DeviceEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

import { DeviceConnectionStateService, DeviceConnectionStateValue } from './device-connection-state.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyValueService } from './property-value.service';

/** Projects shared structural metadata and current runtime state into detached provider inputs. */
@Injectable()
export class DeviceCommandGraphService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceCommandGraphService');

	constructor(
		private readonly metadata: PropertyMetadataService,
		private readonly values: PropertyValueService,
		private readonly connectivity: DeviceConnectionStateService,
	) {}

	async findOne(id: string): Promise<DeviceEntity | null> {
		const graph = await this.metadata.findDevice(id);
		if (!graph) return null;
		const seen = new Set<object>();
		const states = new Map<string, Promise<DeviceConnectionStateValue>>();
		const visit = async (value: unknown): Promise<void> => {
			if (!value || typeof value !== 'object' || seen.has(value)) return;
			seen.add(value);
			// Capture structural children before attaching live state.
			const children = Object.values(value);
			if (value instanceof DeviceEntity) {
				try {
					if (!states.has(value.id)) states.set(value.id, this.connectivity.readLatest(value));
					const state = await states.get(value.id);
					value.status = Object.assign(new DeviceConnectionStatus(), state, {
						lastChanged: state.lastChanged === null ? null : new Date(state.lastChanged),
					});
				} catch (error) {
					this.logger.error(`Failed to load device status id=${value.id}: ${String(error)}`);
				}
			} else if (value instanceof ChannelPropertyEntity) {
				await this.hydrateProperty(value);
			}
			await Promise.all(children.map(visit));
		};
		await visit(graph);
		return graph;
	}

	async findPropertyTarget(
		id: string,
	): Promise<{ device: DeviceEntity; channel: ChannelEntity; property: ChannelPropertyEntity } | null> {
		const property = await this.metadata.findOne(id);
		if (!property || typeof property.channel === 'string' || typeof property.channel.device === 'string') return null;
		const channelId = property.channel.id;
		const device = await this.findOne(property.channel.device.id);
		const channel = device?.channels.find((item) => item.id === channelId);
		if (!device || !channel || !channel.properties.some((item) => item.id === property.id)) return null;
		await this.hydrateProperty(property);
		property.channel.device.status = device.status;
		return { device, channel, property };
	}

	private async hydrateProperty(property: ChannelPropertyEntity): Promise<void> {
		property.unit = resolvePropertyUnit(property);
		try {
			const value = await this.values.readLatest(property);
			property.value = value === null ? null : new PropertyValueState(value.value, value.lastUpdated, value.trend);
		} catch (error) {
			// Match afterLoad's best-effort hydration; command admission retains its stricter baseline check.
			this.logger.error(`Failed to load property value id=${property.id}: ${String(error)}`);
		}
	}
}
