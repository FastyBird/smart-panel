/* eslint-disable @typescript-eslint/unbound-method */
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyDataService } from '../services/energy-data.service';
import { EnergyMetricsService } from '../services/energy-metrics.service';

import { EnergyIngestionListener } from './energy-ingestion.listener';

describe('EnergyIngestionListener', () => {
	let listener: EnergyIngestionListener;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;
	let valueSourceRegistry: jest.Mocked<PropertyValueSourceRegistryService>;

	// A property whose category the listener cares about. Its channel is a plain id string, matching
	// how the entity is shaped once loaded off a relation that was not eagerly joined.
	const consumptionProperty: ChannelPropertyEntity = {
		id: 'property-1',
		category: PropertyCategory.CONSUMPTION,
		channel: 'channel-1',
		value: { value: 1200, lastUpdated: '2026-08-01T00:00:00.000Z', trend: 'stable' },
	} as unknown as ChannelPropertyEntity;

	beforeEach(async () => {
		const mockChannelQueryBuilder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(undefined),
		} as unknown as SelectQueryBuilder<ChannelEntity>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EnergyIngestionListener,
				{
					provide: getRepositoryToken(ChannelEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockChannelQueryBuilder),
					},
				},
				{
					provide: DeltaComputationService,
					useValue: { computeDelta: jest.fn() },
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
					provide: PropertyValueSourceRegistryService,
					useValue: { isProjected: jest.fn().mockReturnValue(false) },
				},
			],
		}).compile();

		listener = module.get<EnergyIngestionListener>(EnergyIngestionListener);
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
		valueSourceRegistry = module.get(PropertyValueSourceRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief case -----------------------------------------------------------------------

	it('ignores a projected property so the same consumption is not counted twice', async () => {
		valueSourceRegistry.isProjected.mockReturnValue(true);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	// -- supplementary case -----------------------------------------------------------------------
	// Not in the brief, but pinned by the task's own self-review checklist ("do not change what the
	// aggregator does with non-projected properties"). The case above only proves a projection is
	// rejected; it would still pass if the guard rejected every property regardless of origin. This
	// proves a relevant, non-projected property still reaches the channel lookup exactly as before.
	it('still looks up the channel for a non-projected property with a relevant category', async () => {
		valueSourceRegistry.isProjected.mockReturnValue(false);

		await listener.handlePropertyValueSet(consumptionProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
	});
});
