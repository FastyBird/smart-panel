import { Repository } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyClaim, EnergyClaimRegistryService } from '../services/energy-claim.registry.service';
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
		private readonly energyClaims: EnergyClaimRegistryService,
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

		const device = channel.device as DeviceEntity;

		// Every reading arrives more than once — on the meter itself, and again on each projection of
		// it — so the two questions below are "which of those events counts?" and "whose kWh is it?".
		const accounting = await this.resolveAccounting(property, channel, device, mapping.sourceType);

		if (!accounting) {
			return;
		}

		const { meter, deviceId, roomId } = accounting;

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

		// Computed against the *meter*, persisted against the accountable device. Keyed per-channel to
		// avoid false meter-reset warnings when a device has multiple energy channels, and per physical
		// device so that a projection appearing, moving or being removed does not present the baseline
		// with a key it has never seen — which would answer null and silently drop everything the meter
		// accumulated since the previous sample.
		const delta = this.deltaComputation.computeDelta(
			meter.deviceId,
			meter.channelId,
			mapping.sourceType,
			numericValue,
			timestamp,
		);

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
	 * Decides whether this event is the one that counts for its meter, and whose consumption it is.
	 *
	 * Returns null to skip the event entirely; otherwise the meter to compute against — always the
	 * physical property's device and channel — and the device the delta is billed to.
	 *
	 * ## Which event counts
	 *
	 * Every reading arrives once on the property that measured it and once more on each projection of
	 * that property, and `processPropertyValue` writes one delta per event it accepts, so exactly one
	 * of those events may be accepted. Which one depends on whether the *source's own* slot is
	 * recognised as energy, and both cases are real:
	 *
	 * - **the source qualifies** (`electrical_energy.consumption`, the ordinary meter): its own event
	 *   ingests and every projection of it is skipped. Accepting a projection as well would bill the
	 *   same kWh twice;
	 * - **the source does not qualify** (`generic.consumption` projected into an `electrical_energy`
	 *   slot): nothing recognises the source's own event as energy — `findEnergySourceType` answers
	 *   null for its channel — so unless a projection ingests, the meter is missing from every total
	 *   with nothing to surface it. There the claim-holding projection ingests, and the others are
	 *   skipped. This is the case a projection guard cannot see, and where today's duplicates come
	 *   from: nothing arbitrated between two projections of one unrecognised meter.
	 *
	 * Stated the other way round: a projection ingests only when its source would not have ingested on
	 * its own *and* no other projection holds the claim.
	 *
	 * ## Whose kWh it is
	 *
	 * The claim, and only the claim. A split device's channels are presented by virtual devices that
	 * live in the rooms the operator put them in, and billing the room where the hardware happens to
	 * sit is the defect this whole mechanism exists to fix. An unclaimed meter is billed to the device
	 * holding it, which is both today's behaviour and the right answer when nothing has taken it over.
	 *
	 * ## Cost
	 *
	 * This fires on every property value change from every device in the system, so it deliberately
	 * sits *after* the category filter, the value extraction, the channel resolution and the mapping
	 * lookup the handler already performs. An event this listener would not have ingested anyway never
	 * reaches it. What remains is one indexed claim lookup per qualifying reading, plus — only for a
	 * projection — the source read that decides which event counts.
	 */
	private async resolveAccounting(
		property: ChannelPropertyEntity,
		channel: ChannelEntity,
		device: DeviceEntity,
		sourceType: EnergySourceType,
	): Promise<{ meter: { deviceId: string; channelId: string }; deviceId: string; roomId: string | null } | null> {
		const sourcePropertyId = this.valueSourceRegistry.resolve(property);

		// Not a projection: it owns its series, and it is the meter. (An orphaned virtual property
		// resolves to its own id too — its source is gone, so there is nothing it could be forwarding.)
		if (sourcePropertyId === property.id) {
			const claim = await this.resolveClaim(property.id, sourceType);

			return {
				meter: { deviceId: device.id, channelId: channel.id },
				deviceId: claim?.deviceId ?? device.id,
				roomId: claim ? claim.roomId : (device.roomId ?? null),
			};
		}

		const source = await this.channelPropertyRepository
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('property.id = :sourcePropertyId', { sourcePropertyId })
			.getOne();

		if (!source) {
			// The registry named a source that is no longer readable. Nothing ingested on its behalf, so
			// ingesting here is the safe side of the trade: a missing meter is silent, a duplicated one is
			// at least visible in the totals. With no source row there is no physical meter to key the
			// baseline to either, so this projection stands in for one.
			this.logger.debug(`Source property ${sourcePropertyId} of projection ${property.id} not found`);

			return {
				meter: { deviceId: device.id, channelId: channel.id },
				deviceId: device.id,
				roomId: device.roomId ?? null,
			};
		}

		const sourceChannel = source.channel as ChannelEntity;
		const sourceDevice = sourceChannel.device as DeviceEntity;

		if (findEnergySourceType(sourceChannel.category, source.category) !== null) {
			// The source's own event ingests, carrying this projection's attribution if it holds the
			// claim. Nothing left for this one to do.
			return null;
		}

		// Fails closed, unlike the branch above, and the asymmetry is the point. Nothing else ingests an
		// unrecognised meter, so *this* event decides whether the reading is counted at all — and every
		// projection of that meter is holding the same reading. A lookup error read as "unclaimed"
		// would let all of them through at once, billing one reading several times over, permanently.
		// One skipped sample is the cheaper mistake, and it is the one the next reading corrects.
		const claim = await this.energyClaims.resolveClaim(source.id);

		// Skipped only when the meter is *somebody else's*. A meter nothing claims is ingested here
		// rather than dropped: that is the state an installation is in before the claim mechanism has
		// anything to say — no plugin registered, or a projection created before the column existed —
		// and counting it beats losing it.
		if (claim !== null && claim.propertyId !== property.id) {
			return null;
		}

		return {
			// The meter is the physical property, whichever projection is presenting it. Keying the
			// baseline to the claimant instead would restart it every time the claim moved.
			meter: { deviceId: sourceDevice.id, channelId: sourceChannel.id },
			deviceId: device.id,
			roomId: device.roomId ?? null,
		};
	}

	/**
	 * The claim on a meter that measures its own series, or null when nothing has taken it over and it
	 * is therefore accountable for itself.
	 *
	 * One read, answered whole by whichever plugin holds the claim — including the room, so nothing
	 * here has to walk from a claimant back to its device. A second read would be racing a remap: the
	 * claimant repointed at another meter in between would still have supplied the device this meter's
	 * delta is billed to.
	 */
	private async resolveClaim(meterPropertyId: string, sourceType: EnergySourceType): Promise<EnergyClaim | null> {
		// Fails open, unlike the projection branch: this meter's reading is counted either way, and the
		// only thing a failed lookup can cost is the room it is billed to — which is where it went
		// before any of this existed. Dropping the sample instead would lose energy that was measured.
		const claim = await this.energyClaims.resolveClaim(meterPropertyId).catch((error: unknown): EnergyClaim | null => {
			this.logger.error(
				`Failed to resolve the energy claim on property ${meterPropertyId}, attributing to the meter: ${(error as Error).message}`,
			);

			return null;
		});

		if (claim === null) {
			return null;
		}

		// A claim is settled against the slot the projection presents, and the same rule is checked here
		// rather than trusted: a claim can outlive the slot it was settled against — a source channel
		// recategorised underneath it, say — and a claimant that no longer reads what the meter reads
		// would move the kWh under a heading its own device contradicts. Reconciliation releases such a
		// claim on the next structural pass; until then the meter is billed to itself.
		if (claim.sourceType !== sourceType) {
			this.logger.warn(
				`Energy claimant ${claim.propertyId} of property ${meterPropertyId} no longer presents ${sourceType}, attributing to the meter`,
			);

			return null;
		}

		return claim;
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
