import { Repository } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { ENERGY_MODULE_NAME } from '../energy.constants';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyDataService } from '../services/energy-data.service';
import { EnergyMetricsService } from '../services/energy-metrics.service';
import { findEnergySourceType } from '../utils/energy-source-type.utils';

@Injectable()
export class EnergyIngestionListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyIngestionListener');

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		@InjectRepository(ChannelPropertyEntity)
		private readonly channelPropertyRepository: Repository<ChannelPropertyEntity>,
		private readonly deltaComputation: DeltaComputationService,
		private readonly energyData: EnergyDataService,
		private readonly metrics: EnergyMetricsService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
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
			property.category === PropertyCategory.CONSUMPTION ||
			property.category === PropertyCategory.PRODUCTION ||
			property.category === PropertyCategory.GRID_IMPORT ||
			property.category === PropertyCategory.GRID_EXPORT;

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
		const mapping = findEnergySourceType(channel.category, property.category);

		if (!mapping) {
			return;
		}

		// A projected property shares its series with its source. If the source's own event was
		// ingested too, counting this one would double the household total — but only *if* it was:
		// see the method for why that is not a given.
		if (await this.wasIngestedAsSource(property)) {
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

		// Compute delta from cumulative reading (keyed per-channel to avoid
		// false meter-reset warnings when a device has multiple energy channels)
		const delta = this.deltaComputation.computeDelta(deviceId, channel.id, mapping.sourceType, numericValue, timestamp);

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

	/**
	 * True when the event for this property's *source* was itself ingested, so ingesting this one
	 * would count the same watts twice.
	 *
	 * Only a projection can answer "yes" — a property that owns its series has no source to have been
	 * counted for it, and `resolve()` returns its own id, which is the first check below.
	 *
	 * ## Why "is it projected?" is not the question
	 *
	 * It used to be, and that dropped meters. A virtual device projects a source property into a
	 * channel of the *user's* choosing, and it is the channel category that decides whether a reading
	 * is energy at all: a `consumption` property sitting in a `generic` channel is projected into an
	 * `electrical_energy` one, and only the projected event carries the qualifying classification. The
	 * source's own event never made it past the SOURCE_TYPE_MAP lookup, so nothing was double-counted
	 * — the plain projection guard simply discarded the only event that would have ingested that
	 * meter, and it stayed missing from every total with nothing to surface it.
	 *
	 * The symmetric case is real too, which is why this is narrowed rather than removed (unlike
	 * SecurityStateListener's, where re-arming one debounce timer made it unnecessary): here
	 * processPropertyValue() writes one delta per event, so a source and a projection that *both*
	 * qualify would genuinely bill the same kWh twice.
	 *
	 * ## Cost
	 *
	 * This fires on every property value change from every device in the system, so it deliberately
	 * sits *after* the category filter, the value extraction, the channel resolution and the mapping
	 * lookup the handler already performs. An event this listener would not have ingested anyway never
	 * reaches it — which is strictly less work than the old placement, where the registry was consulted
	 * for every event including the overwhelming majority that are not energy at all. The one added
	 * query rides only on events already known to be ingestion-worthy *and* projected: bounded by the
	 * number of linked virtual energy properties, which is a handful.
	 */
	private async wasIngestedAsSource(property: ChannelPropertyEntity): Promise<boolean> {
		const sourcePropertyId = this.valueSourceRegistry.resolve(property);

		// Not a projection: it owns its series. (An orphaned virtual property resolves to its own id
		// too — its source is gone, so there is no source event to have been ingested.)
		if (sourcePropertyId === property.id) {
			return false;
		}

		const source = await this.channelPropertyRepository
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.where('property.id = :sourcePropertyId', { sourcePropertyId })
			.getOne();

		if (!source) {
			// The registry named a source that is no longer readable. Nothing ingested on its behalf,
			// so ingesting here is the safe side of the trade: a missing meter is silent, a duplicated
			// one is at least visible in the totals.
			this.logger.debug(`Source property ${sourcePropertyId} of projection ${property.id} not found`);

			return false;
		}

		const sourceChannel = source.channel as ChannelEntity | undefined;

		return findEnergySourceType(sourceChannel?.category, source.category) !== null;
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
