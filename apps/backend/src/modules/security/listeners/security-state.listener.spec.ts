/* eslint-disable @typescript-eslint/unbound-method */
import { Repository, SelectQueryBuilder } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { SECURITY_STATE_DEBOUNCE_MS } from '../security.constants';
import { SecurityAggregatorService } from '../services/security-aggregator.service';
import { SecurityAlertAckService } from '../services/security-alert-ack.service';
import { SecurityEventsService } from '../services/security-events.service';

import { SecurityStateListener } from './security-state.listener';

describe('SecurityStateListener', () => {
	let listener: SecurityStateListener;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;
	let aggregator: jest.Mocked<SecurityAggregatorService>;
	let channelQueryBuilder: { where: jest.Mock; getOne: jest.Mock };

	// A property whose category the listener cares about. Its channel is a plain id string, matching
	// how the entity is shaped once loaded off a relation that was not eagerly joined.
	const sensorProperty: ChannelPropertyEntity = {
		id: 'property-1',
		category: PropertyCategory.STATE,
		channel: 'channel-1',
	} as unknown as ChannelPropertyEntity;

	/** Answers the listener's channel lookup with the given category. */
	const channelIn = (category: ChannelCategory): void => {
		channelQueryBuilder.getOne.mockResolvedValue({ category });
	};

	beforeEach(async () => {
		// The resolved channel deliberately carries a non-security category by default: a relevant
		// property should reach this lookup and then stop right after it (see the supplementary case
		// below), without falling through to scheduleStateRecalculation()'s debounced setTimeout.
		channelQueryBuilder = {
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue({ category: ChannelCategory.ELECTRICAL_ENERGY }),
		};

		const mockChannelQueryBuilder = channelQueryBuilder as unknown as SelectQueryBuilder<ChannelEntity>;

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
					useValue: {
						aggregateWithErrors: jest.fn().mockResolvedValue({
							status: { activeAlerts: [], armedState: null, alarmState: null },
							providerErrors: 0,
						}),
					},
				},
				{
					provide: SecurityEventsService,
					useValue: { recordAlertTransitions: jest.fn() },
				},
				{
					provide: SecurityAlertAckService,
					useValue: {
						findByIds: jest.fn().mockResolvedValue([]),
						resetAcknowledgement: jest.fn(),
						cleanupStale: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: { emit: jest.fn() },
				},
			],
		}).compile();

		listener = module.get<SecurityStateListener>(SecurityStateListener);
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
		aggregator = module.get(SecurityAggregatorService);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	/** Fires the global debounce and lets the recalculation it starts settle. */
	const flushDebounce = async (): Promise<void> => {
		jest.advanceTimersByTime(SECURITY_STATE_DEBOUNCE_MS);

		// enqueueStateChange() chains through several awaits before it reaches the aggregator; a
		// handful of microtask turns is enough to drain them, and none of them is timer-based.
		for (let turn = 0; turn < 10; turn++) {
			await Promise.resolve();
		}
	};

	// -- the asymmetric projection case (P1) ---------------------------------------------------------
	//
	// A virtual device links a source property into a channel of the *user's* choosing, so a source in
	// a non-security-relevant channel can be projected into a security-relevant one. The source event
	// is then filtered out on channel category by processPropertyChange(), which means the projected
	// event is the only payload carrying the security-relevant classification. The projection guard
	// that used to sit in handlePropertyValueSet discarded exactly that payload, so nothing scheduled a
	// recalculation and the alarm stayed stale. Both assertions below fail against that version: the
	// guard returned before the channel lookup ever happened.

	it('recalculates for a projected property whose channel is security-relevant', async () => {
		jest.useFakeTimers();
		channelIn(ChannelCategory.MOTION);

		await listener.handlePropertyValueSet(sensorProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();

		await flushDebounce();

		expect(aggregator.aggregateWithErrors).toHaveBeenCalled();
	});

	// The discriminator for the case above: it would also pass if the listener simply recalculated for
	// every value-set it ever saw. A projection into a channel the security module does not care about
	// must still cost nothing beyond the lookup — the category filter is what decides, exactly as it
	// does for a source property.
	it('does not recalculate for a projected property whose channel is not security-relevant', async () => {
		jest.useFakeTimers();
		channelIn(ChannelCategory.ELECTRICAL_ENERGY);

		await listener.handlePropertyValueSet(sensorProperty);

		await flushDebounce();

		expect(aggregator.aggregateWithErrors).not.toHaveBeenCalled();
	});

	// -- supplementary case -----------------------------------------------------------------------
	// Pinned by the original task's self-review checklist ("do not change what the aggregator does with
	// non-projected properties"): a relevant property still reaches the channel lookup.
	it('still looks up the channel for a property with a relevant category', async () => {
		await listener.handlePropertyValueSet(sensorProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
	});

	// The in-memory category filter still short-circuits ahead of the lookup, so the removal of the
	// projection guard did not turn every value-set in the system into a database round trip.
	it('rejects an irrelevant property category before any channel lookup', async () => {
		await listener.handlePropertyValueSet({
			id: 'property-2',
			category: PropertyCategory.BRIGHTNESS,
			channel: 'channel-1',
		} as unknown as ChannelPropertyEntity);

		expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	// CREATED/UPDATED/DELETED/RESET are never re-emitted for a projection, and must not be swallowed
	// either — e.g. removing a virtual device's linked motion sensor still needs to clear a stale
	// triggered/alarm state via CHANNEL_PROPERTY_DELETED.
	it('still looks up the channel for a property changed via create/update/delete/reset', async () => {
		await listener.handlePropertyChanged(sensorProperty);

		expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
	});
});
