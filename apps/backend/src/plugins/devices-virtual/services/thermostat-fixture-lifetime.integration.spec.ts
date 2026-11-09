import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BeforeQueryEvent } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import {
	disposeRealThermostatGuardFixtures,
	realThermostatGuardFixture,
} from '../../../../test/support/thermostat-real-guard-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgService } from '../../devices-shelly-ng/services/shelly-ng.service';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

type Fixture = Awaited<ReturnType<typeof realThermostatGuardFixture>>;
interface Scope {
	directory?: string;
	db?: SqliteDataSource;
	id: string;
	relay: string;
	fixture?: Fixture;
	module?: TestingModule;
	moduleClose?: Promise<void>;
	moduleDispose?: () => Promise<void>;
	reports?: ChannelsPropertiesService;
	reportClose?: jest.SpyInstance;
	connector?: ShellyNgService;
	producers: PropertyProducerRegistryService;
	events: EventEmitter2;
	ready: Promise<Fixture>;
	retired: boolean;
	retiredError: Error;
	primary?: { cause: unknown };
	cleanupErrors: unknown[];
	issued: Set<Promise<unknown>>;
	openers: Array<() => void>;
	observers: Array<() => void | Promise<void>>;
	configureSource?: (db: SqliteDataSource, directory: string) => void;
	setupRead?: (event: BeforeQueryEvent<unknown>) => void | Promise<void>;
	compileFailure?: { cause: unknown };
	issue<T>(work: () => Promise<T>): Promise<T>;
	retire(): void;
	close(): Promise<void>;
}

jest.setTimeout(30000); // Two real SQLite/module lifecycles must tolerate hosted runner contention.

const selected = 'SELECT "controllerId", "revision" FROM "devices_virtual_thermostat_configs" WHERE "controllerId" = ?';
const scopes: Scope[] = [];
const gates: Array<() => void> = [];
const expectedErrors = new Set<unknown>();
const construction = new AsyncLocalStorage<Scope>();
const gate = () => {
	let open!: () => void;
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});
	gates.push(open);
	return { promise, open };
};
const wait = async <T>(original: Promise<T>, label: string): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			original,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(label)), 5000);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
};
const seed = async (s: Scope) => {
	const db = s.db,
		deviceId = uuid(),
		channelId = uuid();
	await db.manager.insert(VirtualDeviceEntity, {
		id: s.id,
		name: 'Lifetime controller',
		category: DeviceCategory.THERMOSTAT,
		enabled: true,
		mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
	});
	await db.manager.insert(ShellyNgDeviceEntity, {
		id: deviceId,
		name: 'Lifetime relay',
		identifier: 'shellyplus1pm-a8032abe5084',
		category: DeviceCategory.SWITCHER,
		enabled: true,
		canonicalMac: 'A8032ABE5084',
	});
	await db.manager.insert(ShellyNgChannelEntity, {
		id: channelId,
		device: deviceId,
		name: 'Switch',
		identifier: 'switch:0',
		category: ChannelCategory.SWITCHER,
	} as never);
	await db.manager.insert(ShellyNgChannelPropertyEntity, {
		id: s.relay,
		channel: channelId,
		identifier: 'output',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
	} as never);
	await db.manager.insert(VirtualThermostatConfigEntity, {
		controllerId: s.id,
		ownerDeviceId: s.id,
		schemaVersion: 1,
		revision: 1,
		requestedMode: 'off',
		locked: false,
		policy: {
			heatingSetpoint: 20,
			coolingSetpoint: null,
			coldTolerance: 0.5,
			hotTolerance: 0.5,
			neutralMargin: 1,
			minimumOffMs: 0,
			changeoverMs: 0,
			floor: null,
		},
		heuristic: null,
		contactOpeningMs: 0,
		contactClosingMs: 0,
		configuredAt: new Date(),
		releaseRequestedAt: null,
	});
	const property = await db.manager.findOneOrFail(ChannelPropertyEntity, {
		where: { id: s.relay },
		relations: ['channel', 'channel.device'],
	});
	const channel = property.channel as ChannelEntity,
		device = channel.device as DeviceEntity;
	await db.manager.insert(VirtualThermostatActuatorClaimEntity, {
		id: uuid(),
		controllerId: s.id,
		role: 'heating',
		physicalIdentity: thermostatActuatorIdentity(property, channel, device),
		sourcePropertyId: s.relay,
		sourcePropertyIdentity: s.relay,
		sourceDeviceId: deviceId,
		sourceDeviceIdentity: deviceId,
		contractFingerprint: thermostatPropertyContract(property, channel, device),
		revision: 1,
		state: 'reserved',
		leaseSeconds: 30,
		reason: null,
		releaseRequestedAt: null,
		releasedAt: null,
		releaseEvidence: null,
	});
};

/** The same real resource owner is used by normal afterEach and deliberate turnover/failure cases. */
const begin = (options: Partial<Pick<Scope, 'configureSource' | 'setupRead' | 'compileFailure'>> = {}): Scope => {
	let closing: Promise<void> | undefined;
	const events = new EventEmitter2();
	const s: Scope = {
		...options,
		id: uuid(),
		relay: uuid(),
		events,
		producers: new PropertyProducerRegistryService(events),
		retired: false,
		retiredError: new Error('Original fixture scope retired'),
		cleanupErrors: [],
		issued: new Set(),
		openers: [],
		observers: [],
		get ready() {
			return ready;
		},
		issue: <T>(work: () => Promise<T>): Promise<T> => {
			if (s.retired) throw s.retiredError;
			const original = work();
			s.issued.add(original);
			void original.catch((cause: unknown) => {
				s.primary ??= { cause };
			});
			return original;
		},
		retire: () => {
			s.retired = true;
			s.connector?.revokeCurrentAuthority();
		},
		close: () => {
			if (closing !== undefined) return closing;
			let resolve!: () => void, reject!: (cause: unknown) => void;
			closing = new Promise<void>((yes, no) => {
				resolve = yes;
				reject = no;
			});
			try {
				s.retire();
			} catch (cause) {
				s.cleanupErrors.push(cause);
			}
			const managed = s.fixture?.dispose();
			void managed?.catch(() => undefined);
			for (const open of [...s.openers]) {
				try {
					open();
				} catch (cause) {
					s.cleanupErrors.push(cause);
				}
			}
			void (async () => {
				const attempt = async (operation: () => unknown) => {
					try {
						await operation();
					} catch (cause) {
						s.cleanupErrors.push(cause);
					}
				};
				await raw.catch((cause: unknown) => {
					s.primary ??= { cause };
				});
				const results = await Promise.allSettled([...s.issued]);
				for (const result of results) if (result.status === 'rejected') s.primary ??= { cause: result.reason };
				s.issued.clear();
				if (s.fixture) await attempt(() => managed ?? s.fixture.dispose());
				else if (s.module) await attempt(() => s.moduleClose ?? s.module.close());
				else if (s.reports) await attempt(() => s.reports.onModuleDestroy());
				for (const observer of [...s.observers]) await attempt(observer);
				s.producers.onModuleDestroy();
				if (s.db?.isInitialized) await attempt(() => s.db.destroy());
				if (s.directory) await attempt(() => rm(s.directory, { recursive: true, force: true }));
				if (s.primary) throw s.primary.cause;
				if (s.cleanupErrors.length) throw s.cleanupErrors[0];
			})().then(resolve, reject);
			return closing;
		},
	};
	scopes.push(s);
	const raw = construction.run(s, async () => {
		s.directory = await mkdtemp(join(tmpdir(), 'thermostat-lifetime-'));
		s.db = new SqliteDataSource({
			type: 'sqlite',
			database: join(s.directory, 'runtime.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		});
		s.configureSource?.(s.db, s.directory);
		await s.db.initialize();
		await seed(s);
		if (s.setupRead) s.db.subscribers.push({ beforeQuery: s.setupRead });
		await s.db.query(selected, [s.id]);
		if (s.retired) throw s.retiredError;
		s.fixture = await realThermostatGuardFixture(
			s.db,
			events,
			s.producers,
			new Map<string, ThermostatInstalledQualification>(),
		);
		if (s.retired) throw s.retiredError;
		return s.fixture;
	});
	void raw.catch(() => undefined);
	const ready = raw.catch(async (cause: unknown) => {
		s.primary ??= { cause };
		await s.close().catch(() => undefined);
		throw cause;
	});
	void ready.catch(() => undefined);
	return s;
};

beforeEach(() => {
	const create = Test.createTestingModule.bind(Test) as typeof Test.createTestingModule;
	jest.spyOn(Test, 'createTestingModule').mockImplementation((...args) => {
		const builder = create(...args),
			s = construction.getStore();
		if (!s) return builder;
		const provider = args[0].providers?.find(
			(provider) =>
				typeof provider === 'object' &&
				provider !== null &&
				'provide' in provider &&
				provider.provide === ChannelsPropertiesService,
		);
		if (provider && typeof provider === 'object' && 'useValue' in provider)
			s.reports = provider.useValue as ChannelsPropertiesService;
		if (s.reports) s.reportClose = jest.spyOn(s.reports, 'onModuleDestroy');
		if (s.compileFailure)
			builder.overrideProvider(ManagedServiceManagerService).useFactory({
				factory: () => {
					throw s.compileFailure.cause;
				},
			});
		const compile = builder.compile.bind(builder) as typeof builder.compile;
		jest.spyOn(builder, 'compile').mockImplementation((...parameters) => {
			const original = compile(...parameters);
			void original.then(
				(module) => {
					s.module = module;
					s.connector = module.get(ShellyNgService);
					const close = module.close.bind(module) as typeof module.close;
					s.moduleDispose = close;
					jest.spyOn(module, 'close').mockImplementation((...parameters) => {
						const original = close(...parameters);
						s.moduleClose = original;
						return original;
					});
				},
				() => undefined,
			);
			return original;
		});
		return builder;
	});
});

afterEach(async () => {
	try {
		for (const open of gates.splice(0)) open();
		const results = await Promise.allSettled(scopes.splice(0).map((s) => s.close()));
		try {
			await disposeRealThermostatGuardFixtures();
		} catch (cause) {
			if (!expectedErrors.has(cause)) throw cause;
		}
		for (const result of results)
			if (result.status === 'rejected' && !expectedErrors.has(result.reason)) throw result.reason;
	} finally {
		jest.restoreAllMocks();
		jest.useRealTimers();
		expectedErrors.clear();
	}
});

/** Hold B's own native inspection; late A cleanup must not query or mutate it. */
const inspect = async (s: Scope) => {
	const fixture = await s.ready;
	const session = fixture.captureSession(s.relay);
	expect(session?.isCurrent()).toBe(true);
	const property = await s.db.manager.findOneByOrFail(ChannelPropertyEntity, { id: s.relay });
	await fixture.report(s.relay, false);
	expect(fixture.values.readQualifiedSampleSnapshot(property, 30000, new Date())?.value).toBe(false);
	const path = join(s.directory, 'runtime.sqlite');
	const bytes = await readFile(path);
	const rows = (await s.db.query(selected, [s.id])) as unknown;
	const entered = gate(),
		release = gate();
	let queries = 0;
	const subscriber = {
		beforeQuery: async (event: BeforeQueryEvent<unknown>) => {
			queries++;
			if (event.query === selected) {
				entered.open();
				await release.promise;
			}
		},
	};
	s.db.subscribers.push(subscriber);
	const original = s.db.query(selected, [s.id]);
	await wait(entered.promise, 'B original inspection not entered');
	const baseline = {
		date: Date.now(),
		Date,
		timeout: setTimeout,
		interval: setInterval,
		sends: [...fixture.controls.sends],
		state: s.producers.read(s.relay),
		sample: fixture.values.readQualifiedSampleSnapshot(property, 30000, new Date()),
		queries,
	};
	const target = { invoke: () => 'B' };
	const spy = jest.spyOn(target, 'invoke');
	return async () => {
		expect(s.db.isInitialized).toBe(true);
		expect(await readFile(path)).toEqual(bytes);
		expect(session?.isCurrent()).toBe(true);
		expect({
			date: Date.now(),
			Date,
			timeout: setTimeout,
			interval: setInterval,
			sends: fixture.controls.sends,
			state: s.producers.read(s.relay),
			sample: fixture.values.readQualifiedSampleSnapshot(property, 30000, new Date()),
			queries,
		}).toEqual(baseline);
		expect(target.invoke).toBe(spy);
		expect(target.invoke()).toBe('B');
		release.open();
		expect(await wait(original, 'B original inspection did not finish')).toEqual(rows);
		s.db.subscribers.splice(s.db.subscribers.indexOf(subscriber), 1);
		expect(await s.db.query(selected, [s.id])).toEqual(rows);
		await fixture.report(s.relay, false);
		expect(Date.now()).toBe(baseline.date + 1);
		expect(session?.isCurrent()).toBe(true);
	};
};
const closed = async (s: Scope) => {
	expect(s.db?.isInitialized ?? false).toBe(false);
	if (s.directory)
		await expect(readFile(join(s.directory, 'runtime.sqlite'))).rejects.toMatchObject({ code: 'ENOENT' });
};
const rejects = async (original: Promise<unknown>, cause: unknown) => {
	await expect(wait(original, 'original cleanup did not settle')).rejects.toBe(cause);
	expectedErrors.add(cause);
};

describe('actual managed fixture setup and cleanup ownership', () => {
	it('retires an unadopted held setup and closes only its original SQLite resources', async () => {
		const entered = gate(),
			release = gate();
		const a = begin({
			setupRead: async (event) => {
				if (event.query === selected) {
					entered.open();
					await release.promise;
				}
			},
		});
		await wait(entered.promise, 'A setup read not entered');
		expect(a.db.isInitialized).toBe(true);
		expect(a.fixture).toBeUndefined();
		const cleanup = a.close();
		void cleanup.catch(() => undefined);
		expect(a.close()).toBe(cleanup);
		const b = begin(),
			finishB = await inspect(b);
		release.open();
		await rejects(a.ready, a.retiredError);
		await rejects(cleanup, a.retiredError);
		await closed(a);
		await finishB();
	});

	it('joins original native SQL and derived publication after retirement without advancing another fixture', async () => {
		const a = begin(),
			fixture = await a.ready;
		const session = fixture.captureSession(a.relay);
		expect(session?.isCurrent()).toBe(true);
		const property = await a.db.manager.findOneByOrFail(ChannelPropertyEntity, { id: a.relay });
		const lease = a.producers.register(property, 1);
		const valueEntered = gate(),
			valueRelease = gate();
		const originalLock = fixture.values['withValueLock'](property.id, async () => {
			valueEntered.open();
			await valueRelease.promise;
		});
		await wait(valueEntered.promise, 'original value lock not entered');
		const now = new Date();
		const publication = fixture.values.publishDerived(property, lease, false, {
			quality: 'good',
			reasons: [],
			sampledAt: now,
			evaluatedAt: now,
			expiresAt: new Date(now.getTime() + 60000),
		});
		expect(a.issue(() => publication)).toBe(publication);
		const entered = gate(),
			release = gate();
		a.db.subscribers.push({
			beforeQuery: async (event) => {
				if (event.query === selected) {
					entered.open();
					await release.promise;
				}
			},
		});
		const original = a.db.query(selected, [a.id]);
		expect(a.issue(() => original)).toBe(original);
		await wait(entered.promise, 'original A SELECT not entered');
		const cleanup = a.close();
		void cleanup.catch(() => undefined);
		expect(session?.isCurrent()).toBe(false);
		const b = begin(),
			finishB = await inspect(b);
		release.open();
		valueRelease.open();
		expect(await wait(original, 'original A SELECT did not finish')).toEqual([{ controllerId: a.id, revision: 1 }]);
		expect((await publication).changed).toBe(true);
		await originalLock;
		await cleanup;
		await fixture.report(a.relay, false); // Late callback remains A-owned and cannot tick B.
		expect(() => a.issue(() => Promise.resolve())).toThrow(a.retiredError);
		expect(b.producers.owns(a.relay)).toBe(false);
		await closed(a);
		await finishB();
	});

	it.each([
		{ name: 'undefined', primary: { cause: undefined } },
		{ name: 'null', primary: { cause: null } },
		{ name: 'false', primary: { cause: false } },
		{ name: 'string', primary: { cause: 'original native P' } },
		{ name: 'Error', primary: { cause: new Error('original native P') } },
		{ name: 'cleanup only', primary: undefined },
	])('preserves native P ahead of actual module-close Q with B inspecting: $name', async ({ primary }) => {
		const a = begin();
		await a.ready;
		const entered = gate(),
			release = gate(),
			q = new Error('original module close Q');
		a.db.subscribers.push({
			beforeQuery: async (event) => {
				if (event.query === selected) {
					entered.open();
					await release.promise;
					// Deliberately inject present falsy native failures.
					// eslint-disable-next-line @typescript-eslint/only-throw-error
					if (primary) throw primary.cause;
				}
			},
		});
		const original = a.db.query(selected, [a.id]);
		expect(a.issue(() => original)).toBe(original);
		void original.catch(() => undefined);
		await wait(entered.promise, 'native failure read not entered');
		const module = a.module,
			close = a.moduleDispose;
		// E2 replaces the actual A lifecycle entry; A cleanup must not restore E1 over it.
		Object.defineProperty(module, 'close', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: async () => {
				await close();
				throw q;
			},
		});
		const descriptor = Object.getOwnPropertyDescriptor(module, 'close');
		const cleanup = a.close();
		void cleanup.catch(() => undefined);
		const b = begin(),
			finishB = await inspect(b);
		release.open();
		if (primary) await rejects(original, primary.cause);
		else expect(await original).toEqual([{ controllerId: a.id, revision: 1 }]);
		await rejects(cleanup, primary ? primary.cause : q);
		expect(a.cleanupErrors).toContain(q);
		expect(Object.getOwnPropertyDescriptor(module, 'close')).toEqual(descriptor);
		expect(a.close()).toBe(cleanup);
		await closed(a);
		await finishB();
	});

	it.each(['initialize', 'compile', 'undefined', 'null', 'false'] as const)(
		'closes partial real setup resources and retains the setup cause: %s',
		async (kind) => {
			const p =
				kind === 'undefined'
					? undefined
					: kind === 'null'
						? null
						: kind === 'false'
							? false
							: new Error('original factory P');
			const q = new Error('partial setup cleanup Q');
			const scope = begin({
				compileFailure: kind === 'compile' ? { cause: p } : undefined,
				configureSource: (db, directory) => {
					if (kind === 'initialize')
						db.setOptions({ database: directory }); // Real SQLite open failure.
					else if (kind !== 'compile') {
						scope.observers.push(() => {
							throw q;
						});
						// eslint-disable-next-line @typescript-eslint/only-throw-error -- Deliberate falsy setup failure.
						throw p;
					}
				},
			});
			const observed = await scope.ready.then(
				() => {
					throw new Error('setup unexpectedly succeeded');
				},
				(cause: unknown) => ({ cause }),
			);
			if (kind === 'initialize') expect(observed.cause).toMatchObject({ code: 'SQLITE_CANTOPEN' });
			else expect(observed.cause).toBe(p);
			expectedErrors.add(observed.cause);
			const cleanup = scope.close();
			expect(scope.close()).toBe(cleanup);
			await rejects(cleanup, observed.cause);
			await closed(scope);
			if (kind === 'compile') {
				expect(scope.reports).toBeInstanceOf(ChannelsPropertiesService);
				expect(scope.reportClose).toHaveBeenCalledTimes(1);
			} else if (kind !== 'initialize') expect(scope.cleanupErrors).toContain(q);
		},
	);

	it.each(['module-close', 'authority-revoke'] as const)(
		'publishes the original managed cleanup promise before synchronous reentry: %s',
		async (kind) => {
			const scope = begin(),
				fixture = await scope.ready;
			const session = fixture.captureSession(scope.relay);
			const module = scope.module,
				close = scope.moduleDispose;
			let reentered: Promise<void> | undefined,
				once = false;
			const reenter = () => {
				if (!once) {
					once = true;
					reentered = fixture.dispose();
				}
			};
			const closeSpy = jest.spyOn(module, 'close').mockImplementation(() => {
				if (kind === 'module-close') reenter();
				return close();
			});
			if (kind === 'authority-revoke') {
				const connector = scope.connector,
					revoke = connector.revokeCurrentAuthority.bind(connector) as typeof connector.revokeCurrentAuthority;
				jest.spyOn(connector, 'revokeCurrentAuthority').mockImplementation(() => {
					reenter();
					revoke();
				});
			}
			const original = fixture.dispose();
			await wait(original, 'managed cleanup did not finish');
			expect(reentered).toBe(original);
			expect(fixture.dispose()).toBe(original);
			expect(closeSpy).toHaveBeenCalledTimes(1);
			expect(session?.isCurrent()).toBe(false);
			expect(scope.db.isInitialized).toBe(true);
			await scope.close();
			await closed(scope);
		},
	);

	it('attempts every snapshotted real disposer even when the first removes itself and rejects', async () => {
		const a = begin(),
			af = await a.ready,
			b = begin(),
			bf = await b.ready;
		const as = af.captureSession(a.relay),
			bs = bf.captureSession(b.relay),
			q = new Error('first original close Q');
		const am = a.module,
			ac = a.moduleDispose;
		const first = jest.spyOn(am, 'close').mockImplementation(async () => {
			await ac();
			throw q;
		});
		const second = jest.spyOn(b.module, 'close');
		await rejects(disposeRealThermostatGuardFixtures(), q);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(as?.isCurrent()).toBe(false);
		expect(bs?.isCurrent()).toBe(false);
		expect(a.db.isInitialized).toBe(true);
		expect(b.db.isInitialized).toBe(true);
		await rejects(a.close(), q);
		await b.close();
		await closed(a);
		await closed(b);
	});

	it.each(['unfinished', 'complete'] as const)(
		'joins the same real SQLite body before source close and preserves successful ownership: %s',
		async (kind) => {
			const scope = begin(),
				fixture = await scope.ready,
				session = fixture.captureSession(scope.relay);
			const entered = gate(),
				release = gate(),
				dispose = jest.spyOn(fixture, 'dispose');
			let readFinished = false,
				bodyComplete = false;
			const original = scope.db.transaction(async (manager) => {
				entered.open();
				await release.promise;
				const rows = await manager.query<unknown>(selected, [scope.id]);
				readFinished = true;
				return { rows, databaseOpen: scope.db.isInitialized };
			});
			expect(scope.issue(() => original)).toBe(original);
			await wait(entered.promise, 'original body transaction did not enter');
			expect(readFinished).toBe(false);
			expect(scope.issued.has(original)).toBe(true);
			let cleanup: Promise<void> | undefined, reentered: Promise<void> | undefined, currentAtOpen: boolean | undefined;
			const closeBody = (): Promise<void> => {
				if (cleanup !== undefined) return cleanup;
				let resolve!: () => void, reject!: (cause: unknown) => void;
				cleanup = new Promise<void>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				if (!bodyComplete) scope.retire();
				currentAtOpen = session?.isCurrent();
				reentered = closeBody();
				release.open();
				void original
					.then(() => {
						scope.issued.delete(original);
					})
					.then(resolve, reject);
				return cleanup;
			};
			try {
				if (kind === 'complete') {
					release.open();
					expect(await original).toEqual({ rows: [{ controllerId: scope.id, revision: 1 }], databaseOpen: true });
					bodyComplete = true; // Success is established only after the actual original result.
				}
				const first = closeBody();
				expect(reentered).toBe(first);
				expect(closeBody()).toBe(first);
				expect(currentAtOpen).toBe(bodyComplete);
				await wait(first, 'body cleanup did not drain original SQL');
				expect(readFinished).toBe(true);
				expect(scope.issued.has(original)).toBe(false);
				expect(await original).toEqual({ rows: [{ controllerId: scope.id, revision: 1 }], databaseOpen: true });
				expect(session?.isCurrent()).toBe(bodyComplete);
				expect(scope.db.isInitialized).toBe(true);
				expect(dispose).not.toHaveBeenCalled();
				if (bodyComplete) {
					await fixture.report(scope.relay, false);
					expect(session?.isCurrent()).toBe(true);
				}
			} finally {
				await closeBody();
				await scope.close();
			}
			await closed(scope);
		},
	);
});
