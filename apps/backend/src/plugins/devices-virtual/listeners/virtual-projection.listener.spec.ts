/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelCategory, EventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualProjectionListener } from './virtual-projection.listener';

describe('VirtualProjectionListener', () => {
	let listener: VirtualProjectionListener;
	let index: { findBySourceProperty: jest.Mock };
	let eventEmitter: { emit: jest.Mock };

	let sourceProperty: ChannelPropertyEntity;
	let virtualA: VirtualChannelPropertyEntity;
	let virtualB: VirtualChannelPropertyEntity;

	// The source property whose value change every test drives off.
	const makeSourceProperty = (): ChannelPropertyEntity => {
		const property = new ChannelPropertyEntity();

		Object.assign(property, {
			id: 'source-prop-1',
			value: new PropertyValueState('old'),
		});

		return property;
	};

	const makeVirtualProperty = (id: string, sourcePropertyId: string): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, {
			id,
			sourcePropertyId,
			valueOrigin: VirtualValueOrigin.SOURCE_LINKED,
			value: new PropertyValueState('old'),
		});

		return property;
	};

	beforeEach(() => {
		sourceProperty = makeSourceProperty();
		virtualA = makeVirtualProperty('virt-a', sourceProperty.id);
		virtualB = makeVirtualProperty('virt-b', sourceProperty.id);

		index = {
			findBySourceProperty: jest.fn(),
		};

		eventEmitter = {
			emit: jest.fn(),
		};

		listener = new VirtualProjectionListener(
			index as unknown as VirtualPropertyIndexService,
			eventEmitter as unknown as EventEmitter2,
		);
	});

	describe('handlePropertyValueSet', () => {
		it('does nothing when no virtual properties project the source', () => {
			index.findBySourceProperty.mockReturnValue([]);

			sourceProperty.value = new PropertyValueState('new');
			listener.handlePropertyValueSet(sourceProperty);

			expect(index.findBySourceProperty).toHaveBeenCalledWith('source-prop-1');
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('re-emits CHANNEL_PROPERTY_VALUE_SET for every registered projection', () => {
			index.findBySourceProperty.mockReturnValue([virtualA, virtualB]);

			sourceProperty.value = new PropertyValueState('new');
			listener.handlePropertyValueSet(sourceProperty);

			expect(eventEmitter.emit).toHaveBeenCalledTimes(2);

			const [eventA, payloadA] = eventEmitter.emit.mock.calls[0];
			expect(eventA).toBe(EventType.CHANNEL_PROPERTY_VALUE_SET);
			expect(payloadA).toBe(virtualA);
			expect(payloadA.value?.value).toBe('new');

			const [eventB, payloadB] = eventEmitter.emit.mock.calls[1];
			expect(eventB).toBe(EventType.CHANNEL_PROPERTY_VALUE_SET);
			expect(payloadB).toBe(virtualB);
			expect(payloadB.value?.value).toBe('new');
		});

		it('propagates a cleared (null) value to projections', () => {
			index.findBySourceProperty.mockReturnValue([virtualA]);

			sourceProperty.value = null;
			listener.handlePropertyValueSet(sourceProperty);

			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

			const [, payload] = eventEmitter.emit.mock.calls[0];
			expect(payload.value).toBeNull();
		});

		it('passes the projection entity as payload so subscribers see the virtual property id', () => {
			index.findBySourceProperty.mockReturnValue([virtualA]);

			sourceProperty.value = new PropertyValueState(42);
			listener.handlePropertyValueSet(sourceProperty);

			const [, payload] = eventEmitter.emit.mock.calls[0];
			// Crucial: payload.id must be the virtual property's id, not sourceProperty.id,
			// otherwise WS subscribers keyed on virtualA would miss the broadcast.
			expect(payload.id).toBe('virt-a');
			expect(payload.id).not.toBe(sourceProperty.id);
		});
	});

	describe('handleChannelInputOccurrence', () => {
		const mockOccurrence: ChannelInputOccurrencePayload = {
			id: 'occ-source-1',
			deviceId: 'device-source-1',
			channelId: 'channel-source-1',
			propertyId: 'source-prop-1',
			channelCategory: ChannelCategory.BUTTON,
			propertyCategory: PropertyCategory.EVENT,
			event: 'press',
			timestamp: '2026-09-17T10:00:00.000Z',
		};

		it('relays occurrences to virtual projections with projection identity preserved', () => {
			const virtualPropWithChannel = {
				...virtualA,
				id: 'virt-a-prop',
				category: PropertyCategory.EVENT,
				channel: {
					id: 'virt-a-chan',
					category: ChannelCategory.BUTTON,
					device: {
						id: 'virt-a-dev',
						category: 'generic',
					},
				},
			} as unknown as VirtualChannelPropertyEntity;

			index.findBySourceProperty.mockReturnValue([virtualPropWithChannel]);

			listener.handleChannelInputOccurrence(mockOccurrence);

			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_INPUT_OCCURRENCE,
				expect.objectContaining({
					deviceId: 'virt-a-dev',
					channelId: 'virt-a-chan',
					propertyId: 'virt-a-prop',
					event: 'press',
					sourceOccurrenceId: 'occ-source-1',
					data: expect.objectContaining({
						projection: {
							originalOccurrenceId: 'occ-source-1',
							sourceDeviceId: 'device-source-1',
							sourceChannelId: 'channel-source-1',
							sourcePropertyId: 'source-prop-1',
						},
					}),
				}),
			);
		});

		it('prevents projection loops when incoming occurrence is already a projection', () => {
			const projectedOccurrence: ChannelInputOccurrencePayload = {
				...mockOccurrence,
				data: {
					projection: {
						originalOccurrenceId: 'occ-source-1',
						sourceDeviceId: 'device-source-1',
						sourceChannelId: 'channel-source-1',
						sourcePropertyId: 'source-prop-1',
					},
				},
			};

			listener.handleChannelInputOccurrence(projectedOccurrence);

			expect(index.findBySourceProperty).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});
});
