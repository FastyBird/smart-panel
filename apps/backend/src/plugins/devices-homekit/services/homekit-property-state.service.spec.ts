import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
} from '../../devices-virtual/entities/devices-virtual.entity';
import { VirtualValueSourceService } from '../../devices-virtual/services/virtual-value-source.service';

import { HomeKitPropertyStateService } from './homekit-property-state.service';

describe('HomeKitPropertyStateService', () => {
	let producers: PropertyProducerRegistryService;
	let sources: PropertyValueSourceRegistryService;
	let service: HomeKitPropertyStateService;
	let events: EventEmitter2;
	const property = () =>
		Object.assign(new ChannelPropertyEntity(), { id: 'physical', value: new PropertyValueState(19) });
	const derived = () =>
		Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'derived',
			valueOrigin: VirtualValueOrigin.DERIVED,
			value: new PropertyValueState(99),
		});
	const publish = (output: ChannelPropertyEntity, guard = () => true, quality: 'good' | 'degraded' = 'good') => {
		const lease = producers.register(output, 1, { isCurrent: guard, reason: 'graph_validation_pending' });
		const now = Date.now();
		expect(
			producers.commit(
				lease,
				new PropertyValueState(21),
				{
					quality,
					reasons: quality === 'degraded' ? ['quorum_partial'] : [],
					sampledAt: new Date(now - 100),
					evaluatedAt: new Date(now),
					expiresAt: new Date(now + 1000),
				},
				producers.version(lease),
			),
		).toBe(true);
		return lease;
	};
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-10-15T10:00:00Z'));
		events = new EventEmitter2();
		producers = new PropertyProducerRegistryService(events);
		sources = new PropertyValueSourceRegistryService();
		service = new HomeKitPropertyStateService(producers, sources);
	});
	afterEach(() => {
		producers.onModuleDestroy();
		jest.useRealTimers();
	});

	it('blocks cold derived history with neither a producer lease nor a registered provider', () => {
		expect(service.read(derived())).toMatchObject({ value: null, unavailable: true, live: false });
		sources.register(new VirtualValueSourceService());
		expect(service.read(derived()).reasons).toEqual(['producer_unavailable']);
	});

	it('withholds unresolved projection history when its provider or source metadata is missing', () => {
		const alias = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			sourcePropertyId: 'derived',
			value: new PropertyValueState(99),
		});
		expect(service.read(alias)).toMatchObject({ unavailable: true, reasons: ['producer_unavailable'] });
		sources.register(new VirtualValueSourceService());
		expect(service.read(alias)).toMatchObject({ unavailable: true, reasons: ['producer_unavailable'] });
	});

	it('does not trust an orphan alias with a stale loaded physical relation when its provider is absent', () => {
		const alias = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'orphan',
			sourcePropertyId: null,
			sourceProperty: property(),
			value: new PropertyValueState(99),
		});
		expect(service.read(alias).unavailable).toBe(true);
	});
	it('withholds controller-shaped local read-only values without parent metadata; preserves settings and information', () => {
		const output = Object.assign(derived(), {
			valueOrigin: VirtualValueOrigin.LOCAL,
			category: PropertyCategory.STATUS,
			permissions: [PermissionType.READ_ONLY],
		});
		expect(service.read(output).unavailable).toBe(true);
		output.channel = 'unhydrated-channel';
		expect(service.read(output).unavailable).toBe(true);
		output.channel = Object.assign(new ChannelEntity(), { category: ChannelCategory.DEVICE_INFORMATION });
		expect(service.read(output)).toMatchObject({ value: 99, unavailable: false });
		output.channel = Object.assign(new ChannelEntity(), { category: ChannelCategory.HEATER });
		output.permissions = [PermissionType.READ_WRITE];
		expect(service.read(output)).toMatchObject({ value: 99, unavailable: false });
	});
	it('reads degraded live output, checks expiry on GET without a timer, and does not renew equal samples', () => {
		const output = derived();
		const lease = publish(output, undefined, 'degraded');
		const before = producers.readDiagnosticState(output.id).producer;
		expect(service.read(output)).toMatchObject({ value: 21, quality: 'degraded', live: true, unavailable: false });
		jest.setSystemTime(Date.now() + 500);
		expect(service.read(output).value).toBe(21);
		expect(producers.readDiagnosticState(output.id).producer).toEqual(before);
		expect(producers.version(lease)).toBe(1);
		jest.setSystemTime(Date.now() + 501);
		expect(service.read(output)).toMatchObject({ unavailable: true, reasons: ['expired'] });
	});
	it('rejects nonfinite producer values and cached producer snapshots without live authority', () => {
		const output = derived();
		const lease = publish(output);
		const now = Date.now();
		producers.commit(
			lease,
			new PropertyValueState(Infinity),
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(now),
				evaluatedAt: new Date(now),
				expiresAt: new Date(now + 1000),
			},
			producers.version(lease),
		);
		expect(service.read(output).reasons).toEqual(['invalid_producer_value']);
		const alias = property();
		alias.value = producers.readDiagnosticState(output.id);
		producers.remove(output.id);
		expect(service.read(alias).reasons).toEqual(['producer_unavailable']);
	});
	it('checks graph guards at GET even when no changed event has been emitted', () => {
		const output = derived();
		let current = true;
		publish(output, () => current);
		const changed = jest.fn();
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, changed);
		current = false;
		expect(service.read(output)).toMatchObject({ unavailable: true, reasons: ['graph_validation_pending'] });
		expect(changed).not.toHaveBeenCalled();
	});
	it('revokes live authority after a backwards clock correction', () => {
		const output = derived();
		publish(output);
		jest.setSystemTime(Date.now() - 1000);
		expect(service.read(output)).toMatchObject({ unavailable: true, reasons: ['clock_invalid'] });
	});
	it('uses canonical producer authority for an alias and does not fall back after disposal', () => {
		const output = derived();
		const lease = publish(output);
		const alias = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: output.id,
			value: new PropertyValueState(99),
		});
		sources.register(new VirtualValueSourceService());
		expect(service.read(alias)).toMatchObject({ value: 21, live: true });
		producers.unregister(lease);
		expect(service.read(alias)).toMatchObject({ unavailable: true, reasons: ['producer_disposed'] });
	});
	it('preserves ordinary physical and legacy projection cache policy', () => {
		expect(service.read(property())).toMatchObject({ value: 19, quality: null, live: false, unavailable: false });
		sources.register(new VirtualValueSourceService());
		const alias = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			sourcePropertyId: 'physical',
			sourceProperty: property(),
			value: new PropertyValueState(18),
		});
		expect(service.read(alias)).toMatchObject({ value: 18, unavailable: false });
	});
	it('fails closed when the value source is suspended or its canonical resolver throws', () => {
		sources.register({
			getType: () => 'test',
			resolve: () => {
				throw new Error('unavailable');
			},
		});
		const output = { ...property(), type: 'test' } as ChannelPropertyEntity;
		expect(service.read(output)).toMatchObject({ unavailable: true, reasons: ['value_source_unavailable'] });
		sources.register({
			getType: () => 'suspended',
			resolve: () => 'physical',
			unavailableReason: () => 'graph_pending',
		});
		expect(service.read({ ...output, type: 'suspended' } as ChannelPropertyEntity)).toMatchObject({
			unavailable: true,
			reasons: ['graph_pending'],
		});
	});
});
