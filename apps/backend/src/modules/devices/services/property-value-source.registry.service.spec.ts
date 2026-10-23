/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualValueSourceService } from '../../../plugins/devices-virtual/services/virtual-value-source.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import {
	PropertyReadPolicyObservation,
	isPropertyReadPolicyObservationCurrent,
	observePropertyReadPolicy,
} from '../models/property-read-policy.model';

import {
	IPropertyValueSource,
	PropertyReadSourceCapture,
	PropertyValueSourceRegistryService,
} from './property-value-source.registry.service';

describe('PropertyValueSourceRegistryService', () => {
	let service: PropertyValueSourceRegistryService;

	const property = (id: string, type: string): ChannelPropertyEntity =>
		({ id, type }) as unknown as ChannelPropertyEntity;

	const source: IPropertyValueSource = {
		getType: () => 'mock-virtual',
		resolve: (p) => (p.id === 'linked' ? 'source-id' : null),
	};

	beforeEach(() => {
		service = new PropertyValueSourceRegistryService();
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('falls back to the property id when no source is registered', () => {
		expect(service.resolve(property('own', 'mock-virtual'))).toBe('own');
		expect(service.isProjected(property('own', 'mock-virtual'))).toBe(false);
	});

	it('resolves to the source key for a registered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'mock-virtual'))).toBe('source-id');
		expect(service.isProjected(property('linked', 'mock-virtual'))).toBe(true);
	});

	it('falls back to the property id when the source returns null', () => {
		service.register(source);

		expect(service.resolve(property('owned', 'mock-virtual'))).toBe('owned');
		expect(service.isProjected(property('owned', 'mock-virtual'))).toBe(false);
	});

	it('ignores properties of an unregistered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'shelly-ng'))).toBe('linked');
	});

	it('does not register a duplicate type', () => {
		expect(service.register(source)).toBe(true);
		expect(service.register(source)).toBe(false);
		expect(service.list()).toEqual(['mock-virtual']);
	});

	it('propagates a registered resolver failure instead of changing the property identity', () => {
		const failure = new Error('resolver unavailable');
		service.register({
			getType: () => 'mock-virtual',
			resolve: () => {
				throw failure;
			},
		});

		expect(() => service.resolve(property('linked', 'mock-virtual'))).toThrow(failure);
	});
});

describe('Read source provenance', () => {
	let registry: PropertyValueSourceRegistryService;
	const property = (): ChannelPropertyEntity =>
		Object.assign(new ChannelPropertyEntity(), { id: 'original', dataType: DataTypeType.FLOAT });
	const source = (resolve: IPropertyValueSource['resolve'] = () => 'physical'): IPropertyValueSource => ({
		getType: () => 'channelpropertyentity',
		resolve,
	});

	beforeEach(() => {
		registry = new PropertyValueSourceRegistryService();
	});

	it('captures own-series fallback without granting value or write authority', () => {
		const input = property();
		const capture = registry.captureReadSource(input);
		expect(registry.readSourceKey(capture)).toBe('original');
		expect(registry.readSourceUnavailableReason(capture)).toBeNull();
		expect(registry.isReadSourceCurrent(capture)).toBe(true);
		expect(registry.readSourceInput(capture)).not.toBe(input);
		expect(registry.readSourceInput(capture)).toBeInstanceOf(ChannelPropertyEntity);
		expect(Object.isFrozen(registry.readSourceInput(capture))).toBe(true);
		expect(Object.isFrozen(capture)).toBe(true);
		expect(JSON.stringify(capture)).toBe('{}');
		expect(Object.keys(capture)).toEqual([]);
	});

	it('captures the original provider key and availability policy', () => {
		registry.register({ ...source(), unavailableReason: () => 'validation_pending', requiresLiveValue: () => true });
		const capture = registry.captureReadSource(property());
		expect(registry.readSourceKey(capture)).toBe('physical');
		expect(registry.readSourceUnavailableReason(capture)).toBe('validation_pending');
		expect(registry.isReadSourceCurrent(capture)).toBe(true);
	});

	it.each(['forged', 'callback', 'undefined'] as const)(
		'refuses %s policy evidence without invoking a supplied verifier',
		(kind) => {
			const callback = jest.fn(() => true);
			const evidence =
				kind === 'forged' ? new PropertyReadPolicyObservation() : kind === 'callback' ? callback : undefined;
			registry.register({ ...source(), captureReadPolicyObservation: () => evidence });
			expect(() => registry.captureReadSource(property())).toThrow('Unqualified or stale read policy observation');
			expect(callback).not.toHaveBeenCalled();
		},
	);

	it('treats qualified observation only as a veto, never as replacement policy authority', () => {
		const state = { generation: 1 };
		let closed = false;
		registry.register({
			...source(),
			unavailableReason: () => (closed ? 'closed' : null),
			captureReadPolicyObservation: () => observePropertyReadPolicy(state, ['generation']),
		});
		const capture = registry.captureReadSource(property());
		closed = true;
		expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(true);
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		registry.closeReadSource(capture);
	});

	it('observes data descriptors without executing a replacement getter and rejects forged dependencies', () => {
		const state = { generation: 1 };
		const observation = observePropertyReadPolicy(state, ['generation']);
		const getter = jest.fn(() => 1);
		Object.defineProperty(state, 'generation', { get: getter });
		expect(isPropertyReadPolicyObservationCurrent(observation)).toBe(false);
		expect(() => observePropertyReadPolicy(state, ['generation'])).toThrow('requires data fields');
		expect(() => observePropertyReadPolicy({}, ['missing'], [new PropertyReadPolicyObservation()])).toThrow(
			'Unqualified',
		);
		expect(getter).not.toHaveBeenCalled();
	});

	it('does not adopt a provider registered after a fallback capture', () => {
		const capture = registry.captureReadSource(property());
		registry.register(source());
		expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(registry.readSourceKey(capture)).toBe('original');
	});

	it('duplicate registration neither replaces nor invalidates original evidence', () => {
		registry.register(source());
		const capture = registry.captureReadSource(property());
		expect(registry.register(source(() => 'replacement'))).toBe(false);
		expect(registry.isReadSourceCurrent(capture)).toBe(true);
		expect(registry.readSourceKey(capture)).toBe('physical');
	});

	it('preserves the provider receiver and supplies the same frozen input on revalidation', () => {
		const seen: ChannelPropertyEntity[] = [];
		const provider = {
			...source(),
			key: 'physical',
			resolve(this: { key: string }, input: ChannelPropertyEntity) {
				seen.push(input);
				return this.key;
			},
		};
		registry.register(provider);
		const input = property();
		const capture = registry.captureReadSource(input);
		expect(registry.isReadSourceCurrent(capture)).toBe(true);
		expect(seen.length).toBeGreaterThan(1);
		expect(seen.every((item) => item === registry.readSourceInput(capture) && Object.isFrozen(item))).toBe(true);
		expect(seen).not.toContain(input);
	});

	it.each(['resolve', 'unavailableReason', 'requiresLiveValue'] as const)(
		'refuses changed %s policy without altering captured data',
		(method) => {
			let changed = false;
			registry.register({
				...source(() => (changed && method === 'resolve' ? 'successor' : 'physical')),
				unavailableReason: () => (changed && method === 'unavailableReason' ? 'closed' : null),
				requiresLiveValue: () => changed && method === 'requiresLiveValue',
			});
			const capture = registry.captureReadSource(property());
			changed = true;
			expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(true);
			expect(registry.isReadSourceCurrent(capture)).toBe(false);
			expect(registry.readSourceKey(capture)).toBe('physical');
			expect(registry.readSourceUnavailableReason(capture)).toBeNull();
		},
	);

	it.each(['getType', 'resolve', 'unavailableReason', 'requiresLiveValue', 'captureReadPolicyObservation'] as const)(
		'refuses replaced %s without invoking its getter',
		(method) => {
			const provider = source();
			registry.register(provider);
			const capture = registry.captureReadSource(property());
			const getter = jest.fn(() => {
				throw new Error('must not dispatch');
			});
			Object.defineProperty(provider, method, { get: getter });
			expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
			expect(registry.isReadSourceCurrent(capture)).toBe(false);
			expect(getter).not.toHaveBeenCalled();
		},
	);

	it('does not let a substituted public structural verifier approve changed evidence', () => {
		const input = property();
		const capture = registry.captureReadSource(input);
		input.id = 'successor';
		const substitute = jest.fn(() => true);
		registry.isReadSourceStructurallyCurrent = substitute;
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(substitute).not.toHaveBeenCalled();
	});

	it.each(['id', 'dataType', 'addition', 'deletion', 'prototype'] as const)(
		'rejects %s mutation of the original input',
		(change) => {
			const input = property();
			const capture = registry.captureReadSource(input);
			switch (change) {
				case 'id':
					input.id = 'successor';
					break;
				case 'dataType':
					input.dataType = DataTypeType.BOOL;
					break;
				case 'addition':
					Object.defineProperty(input, 'extra', { value: true });
					break;
				case 'deletion':
					Reflect.deleteProperty(input, 'id');
					break;
				case 'prototype':
					Object.setPrototypeOf(input, {});
					break;
			}
			expect(registry.isReadSourceCurrent(capture)).toBe(false);
			expect(registry.readSourceInput(capture).id).toBe('original');
		},
	);

	it('owns format arrays and detects in-place changes without freezing caller data', () => {
		const input = property();
		input.format = [0, 100];
		const capture = registry.captureReadSource(input);
		const owned = registry.readSourceInput(capture).format;
		expect(owned).toEqual([0, 100]);
		expect(owned).not.toBe(input.format);
		expect(Object.isFrozen(owned)).toBe(true);
		expect(Object.isFrozen(input.format)).toBe(false);
		input.format[1] = 200;
		expect(owned).toEqual([0, 100]);
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
	});

	it('rejects accessor inputs without invoking them', () => {
		const input = property();
		const getter = jest.fn(() => 'unexpected');
		Object.defineProperty(input, 'extra', { get: getter });
		expect(() => registry.captureReadSource(input)).toThrow('data fields');
		expect(getter).not.toHaveBeenCalled();
	});

	it('fences a provider that changes its method during source resolution', () => {
		const provider = source(() => {
			provider.resolve = () => 'successor';
			return 'physical';
		});
		registry.register(provider);
		expect(() => registry.captureReadSource(property())).toThrow('changed during read');
	});

	it('fences metadata changes made by a resolver callback during capture', () => {
		const input = property();
		registry.register(
			source(() => {
				input.id = 'successor';
				return 'physical';
			}),
		);
		expect(() => registry.captureReadSource(input)).toThrow('changed during capture');
	});

	it('fails closed on resolver errors during revalidation', () => {
		let failed = false;
		registry.register(
			source(() => {
				if (failed) throw new Error('provider closed');
				return 'physical';
			}),
		);
		const capture = registry.captureReadSource(property());
		failed = true;
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(registry.readSourceKey(capture)).toBe('physical');
	});

	it('rejects forged, foreign and explicitly closed captures', () => {
		const capture = registry.captureReadSource(property());
		const foreign = new PropertyValueSourceRegistryService();
		for (const token of [new PropertyReadSourceCapture(), foreign.captureReadSource(property())]) {
			expect(registry.isReadSourceCurrent(token)).toBe(false);
			expect(() => registry.readSourceKey(token)).toThrow('capture unavailable');
		}
		registry.closeReadSource(capture);
		registry.closeReadSource(capture);
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
		expect(() => registry.readSourceInput(capture)).toThrow('capture unavailable');
		expect(() => registry.readSourceKey(capture)).toThrow('capture unavailable');
		expect(() => registry.readSourceUnavailableReason(capture)).toThrow('capture unavailable');
	});

	it('retains real virtual projection identity and fences graph unavailability', () => {
		const state = { validated: true };
		const graph = {
			isValidated: () => state.validated,
			captureReadPolicyObservation: () => observePropertyReadPolicy(state, ['validated']),
			isQuarantined: () => false,
			matchesValueSource: () => true,
			propertyRequiresLiveValue: () => true,
		} as unknown as VirtualDependencyGraphService;
		registry.register(new VirtualValueSourceService(graph));
		const input = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			sourcePropertyId: 'physical',
			valueOrigin: VirtualValueOrigin.SOURCE,
		});
		const capture = registry.captureReadSource(input);
		expect(registry.readSourceKey(capture)).toBe('physical');
		expect(registry.readSourceInput(capture)).toBeInstanceOf(VirtualChannelPropertyEntity);
		expect(registry.isReadSourceCurrent(capture)).toBe(true);
		state.validated = false;
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(registry.readSourceUnavailableReason(capture)).toBeNull();
		expect(registry.unavailableReason(input)).toBe('graph_validation_pending');
	});

	it('fences remapped real virtual properties while preserving the original physical key', () => {
		registry.register(new VirtualValueSourceService());
		const input = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			sourcePropertyId: 'physical',
			valueOrigin: VirtualValueOrigin.SOURCE,
		});
		const capture = registry.captureReadSource(input);
		input.sourcePropertyId = 'replacement';
		expect(registry.isReadSourceCurrent(capture)).toBe(false);
		expect(registry.readSourceKey(capture)).toBe('physical');
		expect(registry.readSourceInput(capture)).toMatchObject({ sourcePropertyId: 'physical' });
		expect(registry.resolve(input)).toBe('replacement');
	});

	describe('R1 descriptor and accessor regressions', () => {
		it.each(['enumerable', 'writable', 'configurable'] as const)(
			'rejects an own-field %s-only change while retaining the original value',
			(flag) => {
				const input = property();
				const capture = registry.captureReadSource(input);
				Object.defineProperty(input, 'id', { [flag]: false });
				expect(input.id).toBe('original');
				expect(registry.readSourceInput(capture).id).toBe('original');
				expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
			},
		);

		it.each(['enumerable', 'writable', 'configurable'] as const)(
			'rejects an array-element %s-only change against original flags, not frozen flags',
			(flag) => {
				const input = property();
				input.format = [0, 100];
				const capture = registry.captureReadSource(input);
				expect(registry.isReadSourceCurrent(capture)).toBe(true);
				Object.defineProperty(input.format, '1', { [flag]: false });
				expect([...input.format]).toEqual([0, 100]);
				expect(registry.readSourceInput(capture).format).toEqual([0, 100]);
				expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
			},
		);

		it('rejects an array length writable-only change without changing contents', () => {
			const input = property();
			input.format = [0, 100];
			const capture = registry.captureReadSource(input);
			expect(registry.isReadSourceCurrent(capture)).toBe(true);
			// Array length is permanently nonenumerable/nonconfigurable; writable can legally close.
			Object.defineProperty(input.format, 'length', { writable: false });
			expect([...input.format]).toEqual([0, 100]);
			expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
			expect(registry.isReadSourceCurrent(capture)).toBe(false);
		});

		it.each(['enumerable', 'writable', 'configurable'] as const)(
			'rejects an observed prototype-field %s-only change',
			(flag) => {
				const input = property();
				const prototype: object = Object.create(ChannelPropertyEntity.prototype) as object;
				Object.defineProperty(prototype, 'type', {
					value: 'channelpropertyentity',
					enumerable: true,
					writable: true,
					configurable: true,
				});
				Object.setPrototypeOf(input, prototype);
				const capture = registry.captureReadSource(input);
				Object.defineProperty(prototype, 'type', { [flag]: false });
				expect(input.type).toBe('channelpropertyentity');
				expect(registry.isReadSourceStructurallyCurrent(capture)).toBe(false);
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
			},
		);

		it('rejects an own type accessor before its getter can run', () => {
			const input = property();
			const getter = jest.fn(() => 'channelpropertyentity');
			Object.defineProperty(input, 'type', { get: getter });
			expect(() => registry.captureReadSource(input)).toThrow('data fields');
			expect(getter).not.toHaveBeenCalled();
		});

		it('preflights all own fields before reading the intentional inherited type getter', () => {
			const input = property();
			const getter = jest.fn(() => 'channelpropertyentity');
			const prototype: object = Object.create(ChannelPropertyEntity.prototype) as object;
			Object.defineProperty(prototype, 'type', { get: getter });
			Object.setPrototypeOf(input, prototype);
			const capture = registry.captureReadSource(input);
			expect(registry.readSourceKey(capture)).toBe('original');
			expect(registry.isReadSourceCurrent(capture)).toBe(true);
			expect(getter).toHaveBeenCalled();
			getter.mockClear();
			const ownGetter = jest.fn(() => 'unexpected');
			Object.defineProperty(input, 'extra', { get: ownGetter });
			expect(() => registry.captureReadSource(input)).toThrow('data fields');
			expect(getter).not.toHaveBeenCalled();
			expect(ownGetter).not.toHaveBeenCalled();
		});
	});
});
