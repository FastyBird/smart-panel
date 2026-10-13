/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
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
			valueOrigin: VirtualValueOrigin.SOURCE,
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

	describe('producer quality snapshot relay', () => {
		const aggregate = (): VirtualChannelPropertyEntity => {
			const device = Object.assign(new VirtualDeviceEntity(), {
				id: 'aggregate',
				mode: VirtualDeviceMode.SENSOR_AGGREGATE,
				category: DeviceCategory.SENSOR,
			});
			const channel = Object.assign(new VirtualChannelEntity(), {
				id: 'temperature',
				device,
				category: ChannelCategory.TEMPERATURE,
			});
			return Object.assign(new VirtualChannelPropertyEntity(), {
				id: 'aggregate-output',
				channel,
				valueOrigin: VirtualValueOrigin.DERIVED,
				sourcePropertyId: null,
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			});
		};

		it('relays unavailable state and deep copies reasons without changing any source/index snapshot', () => {
			const source = aggregate();
			source.value = Object.assign(new PropertyValueState(null), {
				producer: { quality: 'unavailable', reasons: ['expired'], revision: 4 },
			});
			index.findBySourceProperty.mockReturnValue([virtualA, virtualB]);
			listener.handlePropertyValueStateChanged(source);
			expect(eventEmitter.emit.mock.calls.map((call) => call[0])).toEqual([
				'DevicesModule.ChannelProperty.ValueStateChanged',
				'DevicesModule.ChannelProperty.ValueStateChanged',
			]);
			const first = eventEmitter.emit.mock.calls[0][1];
			const second = eventEmitter.emit.mock.calls[1][1];
			expect(first.id).toBe('virt-a');
			expect(first.value.value).toBeNull();
			first.value.producer.reasons.push('mutated subscriber');
			expect((source.value as PropertyValueState & { producer: { reasons: string[] } }).producer.reasons).toEqual([
				'expired',
			]);
			expect(second.value.producer.reasons).toEqual(['expired']);
			expect(virtualA.value?.value).toBe('old');
		});

		it('admits one-hop materialized measurements and refuses projection aliases and virtual controls', () => {
			const source = aggregate();
			source.value = new PropertyValueState(21);
			index.findBySourceProperty.mockReturnValue([virtualA]);
			listener.handlePropertyValueStateChanged(source);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			listener.handlePropertyValueStateChanged(virtualA);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			source.permissions = [PermissionType.READ_WRITE];
			listener.handlePropertyValueStateChanged(source);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
		});

		it('bounds reentrant listener traffic and releases its traversal guard after a subscriber throws', () => {
			index.findBySourceProperty.mockReturnValue([virtualA]);
			eventEmitter.emit.mockImplementation(() => listener.handlePropertyValueStateChanged(sourceProperty));
			listener.handlePropertyValueStateChanged(sourceProperty);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			eventEmitter.emit.mockImplementationOnce(() => {
				throw new Error('consumer failed');
			});
			expect(() => listener.handlePropertyValueStateChanged(sourceProperty)).toThrow('consumer failed');
			eventEmitter.emit.mockImplementation(() => undefined);
			listener.handlePropertyValueStateChanged(sourceProperty);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
		});
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
			expect(payloadA).not.toBe(virtualA);
			expect(Object.getPrototypeOf(payloadA)).toBe(Object.getPrototypeOf(virtualA));
			expect(payloadA.value?.value).toBe('new');
			expect(virtualA.value?.value).toBe('old');

			const [eventB, payloadB] = eventEmitter.emit.mock.calls[1];
			expect(eventB).toBe(EventType.CHANNEL_PROPERTY_VALUE_SET);
			expect(payloadB).not.toBe(virtualB);
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

		it('passes a detached projection snapshot so subscribers see the virtual property id', () => {
			index.findBySourceProperty.mockReturnValue([virtualA]);

			sourceProperty.value = new PropertyValueState(42);
			listener.handlePropertyValueSet(sourceProperty);

			const [, payload] = eventEmitter.emit.mock.calls[0];
			// Crucial: payload.id must be the virtual property's id, not sourceProperty.id,
			// otherwise WS subscribers keyed on virtualA would miss the broadcast.
			expect(payload.id).toBe('virt-a');
			expect(payload.id).not.toBe(sourceProperty.id);
		});

		it('keeps deferred snapshots stable across later source writes', () => {
			index.findBySourceProperty.mockReturnValue([virtualA]);
			const deferred: Array<{ consume: () => void; expected: number }> = [];
			eventEmitter.emit.mockImplementation((_event, payload) => {
				const expected = payload.value.value;
				deferred.push({ consume: () => expect(payload.value.value).toBe(expected), expected });
			});

			sourceProperty.value = new PropertyValueState(1);
			listener.handlePropertyValueSet(sourceProperty);
			const first = eventEmitter.emit.mock.calls[0][1];
			sourceProperty.value = new PropertyValueState(2);
			listener.handlePropertyValueSet(sourceProperty);
			const second = eventEmitter.emit.mock.calls[1][1];

			expect(first).not.toBe(second);
			expect(first.value).not.toBe(sourceProperty.value);
			expect(virtualA.value?.value).toBe('old');
			deferred.forEach(({ consume }) => consume());
			expect(deferred.map(({ expected }) => expected)).toEqual([1, 2]);
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

		it('relays occurrences and preserves integration and endpoint metadata', () => {
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

			listener.handleChannelInputOccurrence({
				...mockOccurrence,
				integration: 'homekit',
				endpoint: 'ep-1',
			});

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_INPUT_OCCURRENCE,
				expect.objectContaining({
					integration: 'homekit',
					endpoint: 'ep-1',
				}),
			);
		});

		it('does not treat user data.projection without originalOccurrenceId as loop', () => {
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

			listener.handleChannelInputOccurrence({
				...mockOccurrence,
				data: { projection: { mode: 'cinema' } },
			});

			expect(index.findBySourceProperty).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
		});
	});
});
