import { DataSource, EntitySubscriberInterface, RemoveEvent, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import { DeviceConnectionStateService } from '../services/device-connection-state.service';
import { PropertyValueService } from '../services/property-value.service';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

@Injectable()
export class ChannelPropertyEntitySubscriber implements EntitySubscriberInterface<ChannelPropertyEntity> {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelPropertyEntitySubscriber');
	private readonly updateTimestamps = new WeakMap<object, { value?: number; observed: boolean }>();

	/** Observe only this subscriber's original timestamp assignment for one native update payload. */
	captureUpdateTimestamp(entity: object): { read: () => number; close: () => void } {
		if (this.updateTimestamps.has(entity)) throw new Error('Property timestamp capture already exists');
		const capture = { value: undefined as number | undefined, observed: false };
		this.updateTimestamps.set(entity, capture);
		return {
			read: () => {
				if (this.updateTimestamps.get(entity) !== capture || !capture.observed || !Number.isFinite(capture.value))
					throw new Error('Original property timestamp callback required');
				return capture.value;
			},
			close: () => {
				if (this.updateTimestamps.get(entity) === capture) this.updateTimestamps.delete(entity);
			},
		};
	}

	constructor(
		private readonly propertyValueService: PropertyValueService,
		private readonly deviceStatusService: DeviceConnectionStateService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ChannelPropertyEntity {
		return ChannelPropertyEntity;
	}

	/**
	 * Extract the device ID from the property's channel relation for logging purposes.
	 * Falls back to the provided fallback ID if the channel/device relation is not loaded.
	 */
	private getResourceId(channel: ChannelEntity | string | undefined, fallbackId: string): string {
		if (!channel || typeof channel === 'string') {
			return fallbackId;
		}

		const device = channel.device;

		if (!device) {
			return fallbackId;
		}

		return typeof device === 'string' ? device : device.id;
	}

	async afterLoad(entity: ChannelPropertyEntity): Promise<void> {
		const resourceId = this.getResourceId(entity.channel, entity.id);

		// Populate unit from spec based on channel category and property category
		entity.unit = resolvePropertyUnit(entity);

		try {
			entity.value = await this.propertyValueService.readLatest(entity);

			this.logger.debug(`Loaded property value from InfluxDB id=${entity.id}, value=${entity.value?.value}`, {
				resource: resourceId,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to load property value from InfluxDB id=${entity.id}, error=${err.message}`, {
				resource: resourceId,
				stack: err.stack,
			});
		}
	}

	beforeUpdate(event: UpdateEvent<ChannelPropertyEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
			const capture = this.updateTimestamps.get(event.entity);
			if (capture) {
				if (capture.observed) throw new Error('Original property timestamp callback repeated');
				capture.observed = true;
				capture.value = Date.prototype.getTime.call(event.entity.updatedAt) as number;
			}
		}
	}

	async afterRemove(event: RemoveEvent<ChannelPropertyEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`No entity found in afterRemove event`);
			return;
		}

		const propertyId = event.entity.id;
		const resourceId = this.getResourceId(event.entity.channel, propertyId);

		try {
			await this.propertyValueService.delete(event.entity);
			await this.deviceStatusService.deleteByProperty(event.entity);

			this.logger.log(`Successfully removed all stored values for id=${propertyId}`, { resource: resourceId });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to remove property value from InfluxDB id=${propertyId} error=${err.message}`, {
				resource: resourceId,
				stack: err.stack,
			});
		}
	}
}
