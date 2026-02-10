import { Repository } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyDataService } from '../services/energy-data.service';
import { EnergyMetricsService } from '../services/energy-metrics.service';

/**
 * Maps channel category + property category to an EnergySourceType.
 */
const SOURCE_TYPE_MAP: Array<{
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	sourceType: EnergySourceType;
}> = [
	{
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		propertyCategory: PropertyCategory.CONSUMPTION,
		sourceType: EnergySourceType.CONSUMPTION_IMPORT,
	},
	{
		channelCategory: ChannelCategory.ELECTRICAL_GENERATION,
		propertyCategory: PropertyCategory.PRODUCTION,
		sourceType: EnergySourceType.GENERATION_PRODUCTION,
	},
];

@Injectable()
export class EnergyIngestionListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyIngestionListener');

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly deltaComputation: DeltaComputationService,
		private readonly energyData: EnergyDataService,
		private readonly metrics: EnergyMetricsService,
	) {}

	onModuleInit(): void {
		this.logger.log('Energy ingestion listener initialized');
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	async handlePropertyValueSet(property: ChannelPropertyEntity): Promise<void> {
		try {
			await this.processPropertyValue(property);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to process energy property value: ${err.message}`, err.stack);
		}
	}

	private async processPropertyValue(property: ChannelPropertyEntity): Promise<void> {
		// Quick check: is this a property category we care about?
		const isRelevantProperty =
			property.category === PropertyCategory.CONSUMPTION || property.category === PropertyCategory.PRODUCTION;

		if (!isRelevantProperty) {
			return;
		}

		// Get the numeric value from the property
		const numericValue = this.extractNumericValue(property);

		if (numericValue === null) {
			return;
		}

		// Resolve the channel to get the channel category and device
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		if (!channelId) {
			this.logger.debug(`Property ${property.id} has no channel, skipping`);
			return;
		}

		const channel = await this.channelRepository
			.createQueryBuilder('channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('channel.id = :channelId', { channelId })
			.getOne();

		if (!channel) {
			this.logger.debug(`Channel ${channelId} not found, skipping`);
			return;
		}

		// Find the matching source type
		const mapping = SOURCE_TYPE_MAP.find(
			(m) => m.channelCategory === channel.category && m.propertyCategory === property.category,
		);

		if (!mapping) {
			return;
		}

		const device = channel.device as DeviceEntity;
		const deviceId = device.id;
		const roomId = device.roomId ?? null;

		// Use the actual measurement timestamp from the property value,
		// falling back to current time only if unavailable.
		// Guard against unparseable strings (e.g. "null", "0") that create Invalid Date.
		let timestamp = new Date();

		if (property.value?.lastUpdated) {
			const parsed = new Date(property.value.lastUpdated);

			if (!isNaN(parsed.getTime())) {
				timestamp = parsed;
			} else {
				this.logger.warn(
					`Unparseable lastUpdated "${String(property.value.lastUpdated)}" for property ${property.id}, using current time`,
				);
			}
		}

		this.metrics.recordSampleProcessed();

		// Compute delta from cumulative reading
		const delta = this.deltaComputation.computeDelta(deviceId, mapping.sourceType, numericValue, timestamp);

		if (!delta) {
			return;
		}

		this.metrics.recordDeltaCreated();

		// Persist the delta
		await this.energyData.saveDelta({
			deviceId,
			roomId,
			sourceType: mapping.sourceType,
			deltaKwh: delta.deltaKwh,
			intervalStart: delta.intervalStart,
			intervalEnd: delta.intervalEnd,
		});
	}

	private extractNumericValue(property: ChannelPropertyEntity): number | null {
		if (!property.value || property.value.value === null || property.value.value === undefined) {
			return null;
		}

		const raw = property.value.value;
		const num = typeof raw === 'number' ? raw : Number(raw);

		if (isNaN(num)) {
			this.logger.debug(`Non-numeric value for property ${property.id}: ${raw}`);
			return null;
		}

		return num;
	}
}
