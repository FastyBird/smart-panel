import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
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
			id: 'source-prop',
			value: new PropertyValueState(21.5, '2026-08-01T00:00:00.000Z', 'stable'),
		});

		return property;
	};

	// A linked virtual property projecting `sourceProperty`. Its starting value is deliberately a
	// different PropertyValueState instance/value than the source's, so a later assertion that the
	// listener copied the source's value across cannot pass by coincidence.
	const makeVirtualProperty = (id: string): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, {
			id,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: 'source-prop',
			value: new PropertyValueState(null, null, null),
		});

		return property;
	};

	beforeEach(() => {
		index = { findBySourceProperty: jest.fn() };
		eventEmitter = { emit: jest.fn() };

		listener = new VirtualProjectionListener(
			index as unknown as VirtualPropertyIndexService,
			eventEmitter as unknown as EventEmitter2,
		);

		// Rebuilt fresh before every test: the listener mutates a projection's `value` in place, so
		// reusing one shared fixture object across tests would let one test's mutation leak into the
		// next and make later assertions pass for the wrong reason.
		sourceProperty = makeSourceProperty();
		virtualA = makeVirtualProperty('virtual-a');
		virtualB = makeVirtualProperty('virtual-b');
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ---------------------------------------------------------------------

	it('re-emits a value event for each virtual property projecting the source', () => {
		index.findBySourceProperty.mockReturnValue([virtualA, virtualB]);

		listener.handlePropertyValueSet(sourceProperty);

		expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_VALUE_SET, virtualA);
		expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_VALUE_SET, virtualB);
	});

	it('emits nothing when no virtual property projects the source', () => {
		index.findBySourceProperty.mockReturnValue([]);

		listener.handlePropertyValueSet(sourceProperty);

		expect(eventEmitter.emit).not.toHaveBeenCalled();
	});

	it('does not recurse when handed a virtual property', () => {
		index.findBySourceProperty.mockReturnValue([]);

		listener.handlePropertyValueSet(virtualA);

		expect(index.findBySourceProperty).toHaveBeenCalledWith(virtualA.id);
		expect(eventEmitter.emit).not.toHaveBeenCalled();
	});

	// -- supplementary case -----------------------------------------------------------------------
	// Not one of the brief's three, but pinned by the task's own self-review checklist ("does the
	// projection carry the source's value across?"). The pinned test above only proves *an* event
	// fires for each projection: since emit is called with the very same (mutated) projection object
	// referenced by `virtualA`/`virtualB`, an identity check against those variables would pass even
	// if the value copy were deleted from the implementation. This asserts the field itself, against
	// a starting value that provably differs from the source's.
	it('copies the source value onto each projection before emitting', () => {
		expect(virtualA.value).not.toBe(sourceProperty.value);
		expect(virtualB.value).not.toBe(sourceProperty.value);

		index.findBySourceProperty.mockReturnValue([virtualA, virtualB]);

		listener.handlePropertyValueSet(sourceProperty);

		expect(virtualA.value).toBe(sourceProperty.value);
		expect(virtualB.value).toBe(sourceProperty.value);
	});
});
