import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';

const gate = () => {
	let resolve: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
};

describe('actual native graph and owned producer-state publication', () => {
	let database: SqliteDataSource,
		graph: VirtualDependencyGraphService,
		registry: PropertyProducerRegistryService,
		state: VirtualProducerStateService,
		events: EventEmitter2;
	const config = new ConfigService({ FB_CLI: 'off' });
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		events = new EventEmitter2();
		registry = new PropertyProducerRegistryService(events);
		graph = new VirtualDependencyGraphService(database, config);
		state = new VirtualProducerStateService(database, registry, graph, events, config);
	});
	afterEach(async () => {
		state?.onModuleDestroy();
		registry?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
	});
	const seed = async () => {
		const device = uuid(),
			channel = uuid(),
			id = uuid();
		await database.manager.insert(VirtualDeviceEntity, {
			id: device,
			name: 'Derived',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: channel,
			device,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
			identifier: 'temperature',
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id,
			channel,
			name: 'Original',
			category: PropertyCategory.TEMPERATURE,
			identifier: 'temperature',
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			valueOrigin: VirtualValueOrigin.DERIVED,
		} as never);
		return database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id });
	};
	it('boots nonempty unavailable overlays, opens only the validated generation, and preserves independent runtime through refresh and disposal', async () => {
		const property = await seed();
		await state.onModuleInit();
		expect(graph.isValidated()).toBe(false);
		expect(registry.read(property.id)?.producer.reasons).toEqual(['graph_validation_pending']);
		await graph.onApplicationBootstrap();
		expect(graph.isValidated()).toBe(true);
		expect(registry.read(property.id)?.producer.reasons).toEqual(['runtime_unavailable']);
		const runtime = registry.register(property, 7),
			before = registry.readDiagnosticState(property.id),
			epoch = registry.version(runtime);
		await graph.refreshQuarantine();
		state.handlePropertyChanged(property);
		state.onModuleDestroy();
		expect(registry.isCurrent(runtime)).toBe(true);
		expect(registry.version(runtime)).toBe(epoch);
		expect(registry.readDiagnosticState(property.id)).toEqual(before);
		state = new VirtualProducerStateService(database, registry, graph, events, config);
		await state.onModuleInit();
		await graph.refreshQuarantine();
		expect(registry.isCurrent(runtime)).toBe(true);
		expect(registry.readDiagnosticState(property.id)).toEqual(before);
	});
	it.each(['refresh', 'synchronous-hook'] as const)(
		'never consults a substituted owns method or overwrites independent B through %s',
		async (route) => {
			const property = await seed();
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			const runtime = registry.register(property, 7);
			const before = registry.readDiagnosticState(property.id);
			const epoch = registry.version(runtime);
			const notified = jest.fn();
			events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, notified);
			state.initializeOutput(property);
			expect(registry.isCurrent(runtime)).toBe(true);
			expect(registry.version(runtime)).toBe(epoch);
			const substituted = jest.spyOn(registry, 'owns').mockReturnValue(false);
			try {
				if (route === 'refresh') {
					await expect(graph.refreshQuarantine()).rejects.toThrow();
					expect(graph.isValidated()).toBe(false);
				} else state.handlePropertyChanged(property);
				expect(substituted).not.toHaveBeenCalled();
				expect(registry.isCurrent(runtime)).toBe(true);
				expect(registry.isAvailable(runtime)).toBe(true);
				expect(registry.version(runtime)).toBe(epoch);
				expect(registry.readDiagnosticState(property.id)).toEqual(before);
				expect(notified).not.toHaveBeenCalled();
				state.onModuleDestroy();
				expect(registry.isCurrent(runtime)).toBe(true);
				expect(registry.readDiagnosticState(property.id)).toEqual(before);
			} finally {
				substituted.mockRestore();
				events.off(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, notified);
			}
		},
	);

	it.each(['runtime', 'durable', 'same-revision-refresh'] as const)(
		'held real stage cannot overwrite %s or publish stale ready metadata',
		async (fault) => {
			const property = await seed(),
				entered = gate(),
				release = gate();
			const original = state.stageOwned.bind(state) as VirtualProducerStateService['stageOwned'];
			let hold = false;
			jest.spyOn(state, 'stageOwned').mockImplementation(async (...args) => {
				const prepared = await original(...args);
				if (hold) {
					hold = false;
					entered.resolve();
					await release.promise;
				}
				return prepared;
			});
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			hold = true;
			const operation = graph.refreshQuarantine();
			const observed = operation.catch((cause: unknown) => cause);
			let runtime: ReturnType<PropertyProducerRegistryService['register']> | undefined;
			try {
				await entered.promise;
				if (fault === 'runtime') runtime = registry.register(property, 9);
				else if (fault === 'durable')
					await database.query('UPDATE devices_module_channels_properties SET name = ? WHERE id = ?', [
						'Foreign',
						property.id,
					]);
				else await graph.refreshQuarantine();
				release.resolve();
				expect(await observed).toBeInstanceOf(Error);
				if (runtime) expect(registry.isCurrent(runtime)).toBe(true);
				expect(graph.isValidated()).toBe(fault === 'same-revision-refresh');
				if (fault === 'same-revision-refresh')
					expect(registry.read(property.id)?.producer.reasons).toEqual(['runtime_unavailable']);
			} finally {
				release.resolve();
				await observed;
			}
		},
	);
	it('never adopts a replacement original stage while initialization is held, then permits a fresh lifecycle', async () => {
		const property = await seed(),
			entered = gate(),
			release = gate();
		const original = graph.readPublicationSnapshot.bind(
			graph,
		) as VirtualDependencyGraphService['readPublicationSnapshot'];
		let held = false;
		jest.spyOn(graph, 'readPublicationSnapshot').mockImplementation(async () => {
			const snapshot = await original();
			if (!held) {
				held = true;
				entered.resolve();
				await release.promise;
			}
			return snapshot;
		});
		const initialization = state.onModuleInit(),
			observed = initialization.catch((cause: unknown) => cause);
		await entered.promise;
		const replacement = jest.spyOn(state, 'stageOwned');
		try {
			release.resolve();
			expect(await observed).toBeInstanceOf(Error);
			expect(replacement).not.toHaveBeenCalled();
			expect(registry.owns(property.id)).toBe(false);
		} finally {
			replacement.mockRestore();
			release.resolve();
			await observed;
		}
		state = new VirtualProducerStateService(database, registry, graph, events, config);
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		expect(registry.read(property.id)?.producer.reasons).toEqual(['runtime_unavailable']);
	});
	it('retains partial original event delivery and exact falsy failure without clearing an independent runtime', async () => {
		const first = await seed(),
			second = await seed();
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		let armed = true,
			runtime: ReturnType<PropertyProducerRegistryService['register']> | undefined;
		const delivered: string[] = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) => {
			delivered.push(property.id);
			if (armed) {
				armed = false;
				runtime = registry.register(second, 9);
				throw JSON.parse('false') as unknown;
			}
		});
		let rejected: { cause: unknown } | undefined;
		try {
			await graph.refreshQuarantine();
		} catch (cause: unknown) {
			rejected = { cause };
		}
		expect(rejected).toEqual({ cause: false });
		expect(delivered).toContain(first.id);
		expect(delivered).toContain(second.id);
		expect(graph.isValidated()).toBe(false);
		expect(state.readPublicationReport()).toMatchObject({
			installed: 2,
			submitted: 2,
			settled: 2,
			failed: 1,
			terminal: 'partial',
		});
		expect(registry.isCurrent(runtime)).toBe(true);
		state.onModuleDestroy();
		expect(registry.isCurrent(runtime)).toBe(true);
	});
	it('joins the original restored-property callback after disposal without replacing independent runtime B', async () => {
		const property = await seed(),
			entered = gate(),
			release = gate();
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		await database.manager.update(VirtualChannelPropertyEntity, property.id, {
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: property.id,
		});
		await graph.refreshQuarantine();
		expect(graph.isQuarantined(property.id)).toBe(true);
		await database.manager.update(VirtualChannelPropertyEntity, property.id, {
			valueOrigin: VirtualValueOrigin.LOCAL,
			sourcePropertyId: null,
		});
		const original = database.manager.findOne.bind(database.manager) as typeof database.manager.findOne;
		const hydration = jest.spyOn(database.manager, 'findOne').mockImplementation(async (...args) => {
			const value = await original(...args);
			entered.resolve();
			await release.promise;
			return value;
		});
		const emit = jest.spyOn(events, 'emit');
		const operation = graph.refreshQuarantine(),
			observed = operation.catch((cause: unknown) => cause);
		try {
			await entered.promise;
			expect(registry.owns(property.id)).toBe(false);
			const runtime = registry.register(property, 11),
				before = registry.readDiagnosticState(property.id),
				version = registry.version(runtime);
			state.onModuleDestroy();
			release.resolve();
			expect(await observed).toBeInstanceOf(Error);
			expect(hydration).toHaveBeenCalledTimes(1);
			expect(emit.mock.calls.filter(([type]) => type === EventType.CHANNEL_PROPERTY_UPDATED)).toHaveLength(1);
			expect(registry.isCurrent(runtime)).toBe(true);
			expect(registry.version(runtime)).toBe(version);
			expect(registry.readDiagnosticState(property.id)).toEqual(before);
			expect(graph.isValidated()).toBe(false);
		} finally {
			release.resolve();
			await observed;
			hydration.mockRestore();
			emit.mockRestore();
		}
	});
	it('captures each settled stage before a later held participant and preserves its original cleanup receiver', async () => {
		await seed();
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		const entered = gate(),
			release = gate(),
			calls: string[] = [];
		const first = {
			validate() {
				return true;
			},
			install() {
				calls.push('install');
				return true;
			},
			publish() {
				return Promise.resolve();
			},
			close() {
				expect(this).toBe(first);
				calls.push('original-close');
			},
		};
		const stopFirst = graph.observeStatePublication({ prepare: () => Promise.resolve(first) });
		const stopSecond = graph.observeStatePublication({
			prepare: async () => {
				entered.resolve();
				await release.promise;
				return { validate: () => true, install: () => true, publish: () => Promise.resolve(), close: () => undefined };
			},
		});
		const operation = graph.refreshQuarantine(),
			observed = operation.catch((cause: unknown) => cause);
		try {
			await entered.promise;
			await Promise.resolve();
			first.close = () => {
				calls.push('replacement-close');
			};
			release.resolve();
			expect(await observed).toBeInstanceOf(Error);
			expect(calls).toEqual(['original-close']);
			expect(graph.isValidated()).toBe(false);
		} finally {
			release.resolve();
			await observed;
			stopFirst();
			stopSecond();
		}
	});
	it.each(['before-snapshot', 'after-snapshot'] as const)(
		'keeps original ordinary callback order and undefined receiver after %s eligibility expires',
		async (boundary) => {
			await seed();
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			const entered = gate(),
				release = gate(),
				calls: string[] = [];
			const stop = graph.observeStatePublication({
				prepare: async (input) => {
					if (boundary === 'after-snapshot') await input;
					entered.resolve();
					await release.promise;
					throw new Error('Owned prepare failed');
				},
			});
			const options = { requiresActivation: false };
			const first = function (this: void) {
				expect(this).toBeUndefined();
				calls.push('first');
				return Promise.resolve();
			};
			const second = function (this: void) {
				expect(this).toBeUndefined();
				calls.push('second');
				return Promise.resolve();
			};
			const stopFirst = graph.observeValidation(first, options),
				stopSecond = graph.observeValidation(second);
			const operation = graph.refreshQuarantine(),
				observed = operation.catch((cause: unknown) => cause);
			try {
				await entered.promise;
				options.requiresActivation = true;
				release.resolve();
				expect(await observed).toEqual(
					new Error(boundary === 'before-snapshot' ? 'Original graph revision changed' : 'Owned prepare failed'),
				);
				expect(calls).toEqual(['first', 'second']);
				expect(graph.isValidated()).toBe(false);
			} finally {
				release.resolve();
				await observed;
				stop();
				stopFirst();
				stopSecond();
			}
		},
	);
	it.each([
		['validate', 'data'],
		['validate', 'getter'],
		['install', 'data'],
		['install', 'getter'],
		['publish', 'data'],
		['publish', 'getter'],
		['close', 'data'],
		['close', 'getter'],
	] as const)('retains original graph stage %s after call %s changes', async (method, mutation) => {
		await seed();
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		const entered = gate(),
			release = gate();
		const first = {
			validate: jest.fn(() => true),
			install: jest.fn(() => method !== 'close'),
			publish: jest.fn(() => Promise.resolve()),
			close: jest.fn(() => undefined),
		};
		if (method === 'publish') first.publish.mockRejectedValue(false);
		const second = {
			validate: () => true,
			install: () => true,
			publish: jest.fn(() => Promise.resolve()),
			close: () => undefined,
		};
		const stopFirst = graph.observeStatePublication({ prepare: () => Promise.resolve(first) });
		const stopSecond = graph.observeStatePublication({
			prepare: async (input) => {
				await input;
				entered.resolve();
				await release.promise;
				return second;
			},
		});
		const fn = first[method],
			descriptor = Object.getOwnPropertyDescriptor(fn, 'call');
		const replacement = jest.fn(() => true),
			getter = jest.fn(() => replacement);
		const observed = graph.refreshQuarantine().then(
			() => ({ fulfilled: true }),
			(cause: unknown) => ({ cause }),
		);
		try {
			await entered.promise;
			Object.defineProperty(fn, 'call', {
				configurable: true,
				...(mutation === 'data' ? { value: replacement } : { get: getter }),
			});
			expect(first[method]).toBe(fn);
			release.resolve();
			const outcome = await observed;
			if (method === 'publish') {
				expect(outcome).toEqual({ cause: false });
				expect(second.publish).toHaveBeenCalledTimes(1);
			} else if (method === 'close')
				expect(outcome).toEqual({ cause: new Error('Producer state installation refused') });
			else expect(outcome).toEqual({ fulfilled: true });
			expect(fn).toHaveBeenCalledTimes(method === 'validate' ? 3 : 1);
			for (const receiver of fn.mock.contexts) expect(receiver).toBe(first);
			for (const args of fn.mock.calls) expect(args).toEqual([]);
			expect(replacement).not.toHaveBeenCalled();
			expect(getter).not.toHaveBeenCalled();
			expect(graph.isValidated()).toBe(method === 'validate' || method === 'install');
		} finally {
			release.resolve();
			await observed;
			if (descriptor) Object.defineProperty(fn, 'call', descriptor);
			else Reflect.deleteProperty(fn, 'call');
			stopFirst();
			stopSecond();
		}
	});

	it.each(['validate', 'install'] as const)(
		'refuses original false graph %s despite call returning true',
		async (method) => {
			await seed();
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			const entered = gate(),
				release = gate();
			const stage = {
				validate: jest.fn(() => method !== 'validate'),
				install: jest.fn(() => method !== 'install'),
				publish: jest.fn(() => Promise.resolve()),
				close: jest.fn(),
			};
			const stop = graph.observeStatePublication({
				prepare: async (input) => {
					await input;
					return stage;
				},
			});
			const stopHeld = graph.observeStatePublication({
				prepare: async (input) => {
					await input;
					entered.resolve();
					await release.promise;
					return {
						validate: () => true,
						install: () => true,
						publish: () => Promise.resolve(),
						close: () => undefined,
					};
				},
			});
			const fn = stage[method],
				descriptor = Object.getOwnPropertyDescriptor(fn, 'call'),
				replacement = jest.fn(() => true);
			const observed = graph.refreshQuarantine().then(
				() => undefined,
				(cause: unknown) => cause,
			);
			try {
				await entered.promise;
				Object.defineProperty(fn, 'call', { configurable: true, value: replacement });
				release.resolve();
				expect(await observed).toBeInstanceOf(Error);
				expect(fn).toHaveBeenCalled();
				expect(stage.publish).not.toHaveBeenCalled();
				expect(stage.close).toHaveBeenCalledTimes(1);
				expect(graph.isValidated()).toBe(false);
				expect(replacement).not.toHaveBeenCalled();
			} finally {
				release.resolve();
				await observed;
				if (descriptor) Object.defineProperty(fn, 'call', descriptor);
				else Reflect.deleteProperty(fn, 'call');
				stop();
				stopHeld();
			}
		},
	);

	it.each([
		[false, 'data'],
		[false, 'getter'],
		[true, 'data'],
		[true, 'getter'],
	] as const)(
		'retains original graph listener activation=%s after call %s changes',
		async (requiresActivation, mutation) => {
			await seed();
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			const entered = gate(),
				release = gate();
			const stop = graph.observeStatePublication({
				prepare: async (input) => {
					await input;
					entered.resolve();
					await release.promise;
					return {
						validate: () => true,
						install: () => true,
						publish: () => Promise.resolve(),
						close: () => undefined,
					};
				},
			});
			let firstSet: ReadonlySet<string>;
			const calls: string[] = [];
			const stopFirst = graph.observeValidation((_revision, quarantined) => {
				calls.push('first');
				firstSet = quarantined;
				(quarantined as Set<string>).add('listener-local');
				return Promise.resolve();
			});
			const listener = jest.fn(function (this: void, revision: number, quarantined: ReadonlySet<string>) {
				expect(this).toBeUndefined();
				expect(revision).toBe(0);
				expect(quarantined).not.toBe(firstSet);
				expect(quarantined.has('listener-local')).toBe(false);
				calls.push('original');
				return Promise.resolve();
			});
			const stopListener = graph.observeValidation(listener, { requiresActivation });
			const descriptor = Object.getOwnPropertyDescriptor(listener, 'call');
			const replacement = jest.fn(() => Promise.resolve()),
				getter = jest.fn(() => replacement);
			const observed = graph.refreshQuarantine().then(
				() => ({ fulfilled: true }),
				(cause: unknown) => ({ cause }),
			);
			try {
				await entered.promise;
				Object.defineProperty(listener, 'call', {
					configurable: true,
					...(mutation === 'data' ? { value: replacement } : { get: getter }),
				});
				release.resolve();
				expect(await observed).toEqual({ fulfilled: true });
				expect(calls).toEqual(['first', 'original']);
				expect(listener).toHaveBeenCalledTimes(1);
				expect(listener.mock.contexts[0]).toBeUndefined();
				expect(replacement).not.toHaveBeenCalled();
				expect(getter).not.toHaveBeenCalled();
			} finally {
				release.resolve();
				await observed;
				if (descriptor) Object.defineProperty(listener, 'call', descriptor);
				else Reflect.deleteProperty(listener, 'call');
				stop();
				stopFirst();
				stopListener();
			}
		},
	);

	it('CLI lifecycle issues no query, registry owner, timer or stage', async () => {
		const dormant = new VirtualProducerStateService(
			database,
			registry,
			graph,
			events,
			new ConfigService({ FB_CLI: 'on' }),
		);
		const owner = jest.spyOn(registry, 'createStateOwner'),
			query = jest.spyOn(database.manager, 'query'),
			stage = jest.spyOn(dormant, 'stageOwned');
		await dormant.onModuleInit();
		dormant.onModuleDestroy();
		expect(owner).not.toHaveBeenCalled();
		expect(query).not.toHaveBeenCalled();
		expect(stage).not.toHaveBeenCalled();
	});
});
