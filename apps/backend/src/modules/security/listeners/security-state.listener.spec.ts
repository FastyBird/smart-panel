/* eslint-disable @typescript-eslint/unbound-method */
import { Repository, SelectQueryBuilder } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { SecurityAggregatorService } from '../services/security-aggregator.service';
import { SecurityAlertAckService } from '../services/security-alert-ack.service';
import { SecurityEventsService } from '../services/security-events.service';

import { SecurityStateListener } from './security-state.listener';

describe('SecurityStateListener', () => {
	let listener: SecurityStateListener;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;
	let valueSourceRegistry: jest.Mocked<PropertyValueSourceRegistryService>;

	// A property whose category the listener cares about. Its channel is a plain id string, matching
	// how the entity is shaped once loaded off a relation that was not eagerly joined.
	const sensorProperty: ChannelPropertyEntity = {
		id: 'property-1',
		category: PropertyCategory.STATE,
		channel: 'channel-1',
	} as unknown as ChannelPropertyEntity;

	beforeEach(async () => {
		// The resolved channel deliberately carries a non-security category: a relevant, non-projected
		// property should reach this lookup and then stop right after it (see the supplementary case
		// below), without falling through to scheduleStateRecalculation()'s debounced setTimeout.
		const mockChannelQueryBuilder = {
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue({ category: ChannelCategory.ELECTRICAL_ENERGY }),
		} as unknown as SelectQueryBuilder<ChannelEntity>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecurityStateListener,
				{
					provide: getRepositoryToken(ChannelEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockChannelQueryBuilder),
					},
				},
				{
					provide: SecurityAggregatorService,
					useValue: { aggregateWithErrors: jest.fn() },
				},
				{
					provide: SecurityEventsService,
					useValue: { recordAlertTransitions: jest.fn() },
				},
				{
					provide: SecurityAlertAckService,
					useValue: { findByIds: jest.fn(), resetAcknowledgement: jest.fn(), cleanupStale: jest.fn() },
				},
				{
					provide: EventEmitter2,
					useValue: { emit: jest.fn() },
				},
				{
					provide: PropertyValueSourceRegistryService,
					useValue: { isProjected: jest.fn().mockReturnValue(false) },
				},
			],
		}).compile();

		listener = module.get<SecurityStateListener>(SecurityStateListener);
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
		valueSourceRegistry = module.get(PropertyValueSourceRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- guard case, mirroring the energy listener's pinned brief case -------------------------------

	it('ignores a projected property so the same sensor state is not counted twice', async () => {
		valueSourceRegistry.isProjected.mockReturnValue(true);

		await listener.handlePropertyChanged(sensorProperty);

		expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	// -- supplementary case -----------------------------------------------------------------------
	// Not in the brief, but pinned by the task's own self-review checklist ("do not change what the
	// aggregator does with non-projected properties"). The case above only proves a projection is
	// rejected; it would still pass if the guard rejected every property regardless of origin. This
	// proves a relevant, non-projected property still reaches the channel lookup exactly as before.
	it('still looks up the channel for a non-projected property with a relevant category', async () => {
		valueSourceRegistry.isProjected.mockReturnValue(false);

		await listener.handlePropertyChanged(sensorProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
	});
});
