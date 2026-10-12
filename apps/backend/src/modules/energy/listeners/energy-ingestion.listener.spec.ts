/* eslint-disable @typescript-eslint/unbound-method */
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { EnergySourceType } from '../energy.constants';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyClaimRegistryService } from '../services/energy-claim.registry.service';
import { EnergyDataService } from '../services/energy-data.service';
import { EnergyMetricsService } from '../services/energy-metrics.service';

import { EnergyIngestionListener } from './energy-ingestion.listener';

describe('EnergyIngestionListener', () => {
	let listener: EnergyIngestionListener;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;
	let valueSourceRegistry: jest.Mocked<PropertyValueSourceRegistryService>;
	let deltaComputation: jest.Mocked<DeltaComputationService>;
	let energyData: jest.Mocked<EnergyDataService>;
	let energyClaims: jest.Mocked<EnergyClaimRegistryService>;
	let channelQueryBuilder: { innerJoinAndSelect: jest.Mock; where: jest.Mock; getOne: jest.Mock };
	let propertyQueryBuilder: { innerJoinAndSelect: jest.Mock; where: jest.Mock; getOne: jest.Mock };

	// A property whose category the listener cares about. Its channel is a plain id string, matching
	// how the entity is shaped once loaded off a relation that was not eagerly joined.
	const consumptionProperty: ChannelPropertyEntity = {
		id: 'property-1',
		category: PropertyCategory.CONSUMPTION,
		channel: 'channel-1',
		value: { value: 1200, lastUpdated: '2026-08-01T00:00:00.000Z', trend: 'stable' },
	} as unknown as ChannelPropertyEntity;

	/** Answers the listener's own channel lookup — the channel the event's property sits in. */
	const propertyIsIn = (category: ChannelCategory): void => {
		channelQueryBuilder.getOne.mockResolvedValue({
			id: 'channel-1',
			category,
			device: { id: 'device-1', roomId: null },
		});
	};

	/**
	 * Answers the source-eligibility lookup with a source property in a channel of `category`. The
	 * source carries its device, because the delta is computed against the *physical* meter whichever
	 * property presents it.
	 */
	const sourceIsIn = (category: ChannelCategory, propertyCategory = PropertyCategory.CONSUMPTION): void => {
		propertyQueryBuilder.getOne.mockResolvedValue({
			id: 'source-1',
			category: propertyCategory,
			channel: { id: 'source-channel-1', category, device: { id: 'source-device-1', roomId: 'utility' } },
		});
	};

	/**
	 * Makes `claimant` the property accountable for the meter, presenting it from `room`. Answered
	 * whole, the way the plugin holding the claim answers it: the ingestion never walks from a claimant
	 * back to its device, because a second read would be racing a remap.
	 */
	const claimedBy = (
		claimant: string,
		room: string | null,
		sourceType: EnergySourceType | null = EnergySourceType.CONSUMPTION_IMPORT,
	): void => {
		energyClaims.resolveClaim.mockResolvedValue({
			propertyId: claimant,
			deviceId: 'virtual-device-1',
			roomId: room,
			sourceType,
		});
	};

	/** Makes the event's property a projection of `source-1`. */
	const projectedFromSource = (): void => {
		valueSourceRegistry.resolve.mockReturnValue('source-1');
	};

	beforeEach(async () => {
		channelQueryBuilder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(undefined),
		};

		propertyQueryBuilder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EnergyIngestionListener,
				{
					provide: getRepositoryToken(ChannelEntity),
					useValue: {
						createQueryBuilder: jest
							.fn()
							.mockReturnValue(channelQueryBuilder as unknown as SelectQueryBuilder<ChannelEntity>),
					},
				},
				{
					provide: getRepositoryToken(ChannelPropertyEntity),
					useValue: {
						createQueryBuilder: jest
							.fn()
							.mockReturnValue(propertyQueryBuilder as unknown as SelectQueryBuilder<ChannelPropertyEntity>),
					},
				},
				{
					provide: DeltaComputationService,
					useValue: {
						computeDelta: jest.fn().mockReturnValue({
							deltaKwh: 0.25,
							intervalStart: new Date('2026-08-01T00:00:00.000Z'),
							intervalEnd: new Date('2026-08-01T00:05:00.000Z'),
						}),
					},
				},
				{
					provide: EnergyDataService,
					useValue: { saveDelta: jest.fn() },
				},
				{
					provide: EnergyMetricsService,
					useValue: { recordSampleProcessed: jest.fn(), recordDeltaCreated: jest.fn() },
				},
				{
					provide: EnergyClaimRegistryService,
					// Nothing claims anything unless a case says so, which is every installation running no
					// plugin that takes a meter over.
					useValue: { resolveClaim: jest.fn().mockResolvedValue(null) },
				},
				{
					provide: PropertyValueSourceRegistryService,
					// The registry's fallback for a property no plugin claims is the property's own id,
					// which is what "not projected" means to the listener.
					useValue: { resolve: jest.fn().mockReturnValue(consumptionProperty.id) },
				},
			],
		}).compile();

		listener = module.get<EnergyIngestionListener>(EnergyIngestionListener);
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
		valueSourceRegistry = module.get(PropertyValueSourceRegistryService);
		deltaComputation = module.get(DeltaComputationService);
		energyData = module.get(EnergyDataService);
		energyClaims = module.get(EnergyClaimRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief case -----------------------------------------------------------------------

	it('ignores a projected property whose source was ingested, so the same consumption is not counted twice', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		// The source qualifies on its own — its event already produced a delta for these watts.
		sourceIsIn(ChannelCategory.ELECTRICAL_ENERGY);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(deltaComputation.computeDelta).not.toHaveBeenCalled();
		expect(energyData.saveDelta).not.toHaveBeenCalled();
	});

	// -- the asymmetric case the plain projection guard dropped -----------------------------------
	// A `consumption` property in a non-qualifying channel projected into an `electrical_energy` one:
	// the source event never reached SOURCE_TYPE_MAP, so nothing ingested it, and the projected event
	// is the only payload carrying the qualifying classification. Asserts the delta is actually
	// persisted — being waved past the guard is worth nothing if it stops somewhere further down.

	it('ingests a projected property whose source channel does not qualify on its own', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		sourceIsIn(ChannelCategory.GENERIC);

		await listener.handlePropertyValueSet(consumptionProperty);

		// Computed against the physical meter, so a projection appearing or the claim moving does not
		// present the baseline with a key it has never seen — which answers null and drops everything
		// accumulated since the previous sample.
		expect(deltaComputation.computeDelta).toHaveBeenCalledWith(
			'source-device-1',
			'source-channel-1',
			EnergySourceType.CONSUMPTION_IMPORT,
			1200,
			new Date('2026-08-01T00:00:00.000Z'),
		);
		expect(energyData.saveDelta).toHaveBeenCalledWith({
			deviceId: 'device-1',
			roomId: null,
			sourceType: EnergySourceType.CONSUMPTION_IMPORT,
			deltaKwh: 0.25,
			intervalStart: new Date('2026-08-01T00:00:00.000Z'),
			intervalEnd: new Date('2026-08-01T00:05:00.000Z'),
		});
	});

	it('ingests a projected property whose source property category does not qualify on its own', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		// Right channel, wrong property category: `rate` in an electrical_energy channel is not a
		// cumulative meter, so SOURCE_TYPE_MAP has no entry for it and its event was never ingested.
		sourceIsIn(ChannelCategory.ELECTRICAL_ENERGY, PropertyCategory.RATE);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).toHaveBeenCalled();
	});

	it('ingests a projected property whose source row can no longer be read', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		propertyQueryBuilder.getOne.mockResolvedValue(null);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).toHaveBeenCalled();
	});

	// -- attribution follows the claim -------------------------------------------------------------
	// Splitting a device moves the devices into rooms but not, until now, their energy: the delta was
	// stamped with the device that owned the property the ingestion read — the physical one — so a
	// room holding only virtual devices reported zero.

	it('bills a claimed meter to the device presenting it', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		claimedBy('virtual-property-1', 'kitchen');

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyClaims.resolveClaim).toHaveBeenCalledWith('property-1');
		expect(energyData.saveDelta).toHaveBeenCalledWith(
			expect.objectContaining({ deviceId: 'virtual-device-1', roomId: 'kitchen' }),
		);
	});

	// Attribution moves; the series does not. Keying the baseline to the claimant would restart it the
	// moment a projection appeared or its claim moved, and `computeDelta` answers null for a key it
	// has not seen — silently dropping everything the meter accumulated since the previous sample.
	it('keeps computing a claimed meter against the device that measures it', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		claimedBy('virtual-property-1', 'kitchen');

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(deltaComputation.computeDelta).toHaveBeenCalledWith(
			'device-1',
			'channel-1',
			EnergySourceType.CONSUMPTION_IMPORT,
			1200,
			new Date('2026-08-01T00:00:00.000Z'),
		);
	});

	// Defence in depth against a claim that outlived the slot it was settled against: moving the kWh
	// under a heading the claimant's own device contradicts is the failure this whole mechanism exists
	// to prevent, so the meter keeps its own attribution instead.
	it('bills the meter itself when its claimant no longer presents the same reading', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		claimedBy('virtual-property-1', 'kitchen', EnergySourceType.GRID_EXPORT);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-1', roomId: null }));
	});

	it('bills a meter nobody claims to the device holding it', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-1', roomId: null }));
	});

	// A source the ingestion does not recognise on its own is counted by whichever projection holds the
	// claim, and by that one only — every projection of it carries the qualifying classification, so
	// without an arbiter each one bills the same kWh again.
	it('ingests an unrecognised meter through the projection that claims it', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		sourceIsIn(ChannelCategory.GENERIC);
		claimedBy(consumptionProperty.id, null);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyClaims.resolveClaim).toHaveBeenCalledWith('source-1');
		expect(energyData.saveDelta).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-1' }));
	});

	it('skips a projection of an unrecognised meter another projection claims', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		sourceIsIn(ChannelCategory.GENERIC);
		claimedBy('another-projection', 'office');

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(deltaComputation.computeDelta).not.toHaveBeenCalled();
		expect(energyData.saveDelta).not.toHaveBeenCalled();
	});

	// The two branches fail in opposite directions, and the asymmetry is the point.

	it('bills a meter to itself when its claim cannot be looked up', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		energyClaims.resolveClaim.mockRejectedValue(new Error('database is locked'));

		await listener.handlePropertyValueSet(consumptionProperty);

		// The reading is counted either way; only the room was ever in question.
		expect(energyData.saveDelta).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-1' }));
	});

	// Every projection of an unrecognised meter is holding the same reading, and nothing else ingests
	// it — so a lookup error read as "unclaimed" would let all of them through at once and bill one
	// reading several times over, permanently. One skipped sample is the cheaper mistake.
	it('skips a projection of an unrecognised meter when the claim cannot be looked up', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);
		projectedFromSource();
		sourceIsIn(ChannelCategory.GENERIC);
		energyClaims.resolveClaim.mockRejectedValue(new Error('database is locked'));

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).not.toHaveBeenCalled();
	});

	// -- supplementary cases ----------------------------------------------------------------------
	// Not in the brief, but pinned by the task's own self-review checklist ("do not change what the
	// aggregator does with non-projected properties").

	it('still looks up the channel for a non-projected property with a relevant category', async () => {
		await listener.handlePropertyValueSet(consumptionProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
	});

	it('ingests a non-projected property in a qualifying channel', async () => {
		propertyIsIn(ChannelCategory.ELECTRICAL_ENERGY);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(energyData.saveDelta).toHaveBeenCalled();
	});

	// The source-eligibility lookup is the one query this listener added, and it must never fire for
	// the events it was already going to reject — that is what keeps it off the hot path.

	it('does not consult the value source registry for a property in a non-qualifying channel', async () => {
		propertyIsIn(ChannelCategory.GENERIC);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(valueSourceRegistry.resolve).not.toHaveBeenCalled();
		expect(propertyQueryBuilder.getOne).not.toHaveBeenCalled();
	});

	it('does not consult the value source registry for an irrelevant property category', async () => {
		await listener.handlePropertyValueSet({
			...consumptionProperty,
			category: PropertyCategory.HUMIDITY,
		} as unknown as ChannelPropertyEntity);

		expect(valueSourceRegistry.resolve).not.toHaveBeenCalled();
		expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
	});
});
