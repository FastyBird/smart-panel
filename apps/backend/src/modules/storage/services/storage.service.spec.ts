/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource } from 'typeorm';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../config/services/config.service';
import { ConnectionState, DataTypeType } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ControllerPublicationContext } from '../../devices/services/controller-publication-context';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../devices/services/property-value.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StoragePoint, StorageQueryOptions } from '../storage.types';

import { StorageService } from './storage.service';

describe('StorageService', () => {
	const createPlugin = (name: string): jest.Mocked<StoragePlugin> =>
		({
			name,
			isAvailable: jest.fn().mockReturnValue(true),
			writePoints: jest.fn(),
			query: jest.fn(),
			registerSchema: jest.fn(),
		}) as unknown as jest.Mocked<StoragePlugin>;

	const gate = () => {
		let release!: () => void;
		const promise = new Promise<void>((resolve) => {
			release = resolve;
		});
		return { promise, release };
	};
	const propertyFixture = () => {
		const storage = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'memory' }),
		} as unknown as ConfigService);
		const registry = new PropertyValueSourceRegistryService();
		const lock = new PropertyValueLockService(
			{} as DataSource,
			new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }),
		);
		expect(lock.isEnabled()).toBe(false);
		const values = new PropertyValueService(storage, registry, lock);
		const property = {
			id: 'setting',
			type: 'owned-fixture',
			dataType: DataTypeType.FLOAT,
			invalid: null,
			format: [0, 100],
			step: null,
		} as ChannelPropertyEntity;
		return { storage, registry, values, property, lock };
	};
	const cached = (values: PropertyValueService) =>
		(Reflect.get(values, 'valuesMap') as Map<string, { value: unknown; lastUpdated: string }>).get('setting');
	const failOriginal = (cause: unknown): never => {
		throw cause;
	};
	const originalFailures = [new Error('original storage failure'), undefined, null, false, 0, ''];

	it.each([false, true])('pins queued owned property history with eligibility=%s', async (eligibleAtDelivery) => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary'),
			fallback = createPlugin('memory'),
			successorPrimary = createPlugin('primary'),
			successorFallback = createPlugin('memory');
		const predecessorEntered = gate(),
			predecessorRelease = gate(),
			fallbackEntered = gate(),
			fallbackRelease = gate();
		let primaryCalls = 0,
			fallbackCalls = 0;
		let primaryPoints: StoragePoint[] = [],
			fallbackPoints: StoragePoint[] = [],
			fallbackBefore: StoragePoint[] = [];
		const primaryReceivers: StoragePlugin[] = [],
			fallbackReceivers: StoragePlugin[] = [];
		primary.writePoints.mockImplementation(async function (this: StoragePlugin, points) {
			if (points[0].fields.numberValue === 10) {
				predecessorEntered.release();
				await predecessorRelease.promise;
			} else if (points[0].fields.numberValue === 20) {
				primaryCalls++;
				primaryReceivers.push(this);
				primaryPoints = points;
			}
		});
		fallback.writePoints.mockImplementation(async function (this: StoragePlugin, points) {
			if (points[0].fields.numberValue !== 20) return;
			fallbackCalls++;
			fallbackReceivers.push(this);
			fallbackPoints = points;
			fallbackBefore = structuredClone(points);
			fallbackEntered.release();
			await fallbackRelease.promise;
			points[0].fields.numberValue = 99;
			points[0].tags.propertyId = 'changed-by-fallback';
			points[0].timestamp.setFullYear(2032);
		});
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('memory', fallback);
		const predecessor = values.writeStrict(property, 10);
		let queued!: Promise<boolean>, parent!: Promise<void>, work!: Promise<void>;
		let eligible = true,
			settled = false;
		const publication = new ControllerPublicationContext(() => eligible);
		const timestamp = new Date('2026-01-02T03:04:05.000Z');
		const expected = [
			{
				measurement: 'property_value',
				tags: { propertyId: 'setting' },
				fields: { numberValue: 20 },
				timestamp: new Date(timestamp),
			},
		];
		try {
			await predecessorEntered.promise;
			work = ControllerPublicationContext.complete(() => {
				parent = publication.run(() => {
					queued = values.write(property, 20, timestamp);
					return Promise.resolve();
				});
				return parent;
			});
			void work.then(
				() => {
					settled = true;
				},
				() => {
					settled = true;
				},
			);
			await parent;
			storage.registerPlugin('primary', successorPrimary);
			storage.registerPlugin('memory', successorFallback);
			primary.writePoints = createPlugin('replacement-primary-method').writePoints;
			fallback.writePoints = createPlugin('replacement-fallback-method').writePoints;
			primary.isAvailable.mockReturnValue(false);
			fallback.isAvailable.mockReturnValue(false);
			property.id = 'mutated';
			property.format = [0, 1];
			timestamp.setFullYear(2030);
			eligible = eligibleAtDelivery;
			predecessorRelease.release();
			await predecessor;
			expect(await Promise.race([fallbackEntered.promise.then(() => 'fallback'), queued.then(() => 'finished')])).toBe(
				'fallback',
			);
			expect(settled).toBe(false);
			expect(primaryCalls).toBe(0);
			fallbackRelease.release();
			expect(await queued).toBe(true);
			await work;
			expect(fallbackBefore).toEqual(expected);
			expect(primaryPoints).toEqual(expected);
			expect(primaryReceivers[0]).toBe(primary);
			expect(fallbackReceivers[0]).toBe(fallback);
			expect(primaryCalls).toBe(1);
			expect(fallbackCalls).toBe(1);
			expect(primaryPoints).not.toBe(fallbackPoints);
			expect(primaryPoints[0].fields).not.toBe(fallbackPoints[0].fields);
			expect(primaryPoints[0].tags).not.toBe(fallbackPoints[0].tags);
			expect(primaryPoints[0].timestamp).not.toBe(fallbackPoints[0].timestamp);
			for (const successor of [successorPrimary, successorFallback])
				expect(
					successor.writePoints.mock.calls.some(([points]) => points.some((point) => point.fields.numberValue === 20)),
				).toBe(false);
			const cache = Reflect.get(values, 'valuesMap') as Map<string, { value: number }>;
			expect(cache.get('setting').value).toBe(eligibleAtDelivery ? 20 : 10);
			expect(publication.facts().filter((fact) => fact.name.startsWith('storage.'))).toEqual([
				{ name: 'storage.fallback', submitted: true, settled: true, failed: false, retired: !eligibleAtDelivery },
				{ name: 'storage.primary', submitted: true, settled: true, failed: false, retired: !eligibleAtDelivery },
			]);
		} finally {
			predecessorRelease.release();
			fallbackRelease.release();
			await Promise.allSettled([predecessor, ...[queued, parent, work].filter((job) => job !== undefined)]);
			await storage.onApplicationShutdown();
		}
	});

	it.each([false, true])(
		'retains owned destinations through an actual buffered drain, rejected=%s',
		async (rejectBuffer) => {
			const { storage, values, property } = propertyFixture();
			const primary = createPlugin('primary'),
				successor = createPlugin('primary');
			const entered = gate(),
				release = gate();
			const events: string[] = [];
			let direct: StoragePoint[] = [];
			primary.writePoints.mockImplementation(async (points) => {
				if (points[0].measurement === 'buffered-original') {
					entered.release();
					await release.promise;
					events.push('buffered-ended');
					if (rejectBuffer) throw new Error('original buffered callback failed');
				} else {
					direct = structuredClone(points);
					events.push('owned-written');
				}
			});
			storage.registerPlugin('primary', primary);
			const historical = storage.enqueueWritePoint({ measurement: 'buffered-original', fields: { numberValue: 1 } });
			let queued: Promise<boolean> | undefined;
			try {
				await entered.promise;
				queued = new ControllerPublicationContext(() => true).run(() => values.write(property, 20));
				await historical;
				const buffer = Reflect.get(storage, 'writes') as { waiters: unknown[] };
				expect(buffer.waiters.length).toBeGreaterThan(0);
				storage.registerPlugin('primary', successor);
				primary.writePoints = createPlugin('replacement-method').writePoints;
				primary.isAvailable.mockReturnValue(false);
				release.release();
				expect(await queued).toBe(true);
				expect(events).toEqual(['buffered-ended', 'owned-written']);
				expect(direct).toHaveLength(1);
				expect(direct[0]).toMatchObject({
					measurement: 'property_value',
					tags: { propertyId: 'setting' },
					fields: { numberValue: 20 },
				});
				expect(successor.writePoints).not.toHaveBeenCalled();
			} finally {
				release.release();
				await Promise.allSettled([historical, ...(queued !== undefined ? [queued] : [])]);
				await storage.onApplicationShutdown();
			}
		},
	);

	it('does not upgrade a queued disconnected owned write to a later healthy backend', async () => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary'),
			successor = createPlugin('primary');
		const entered = gate(),
			release = gate();
		primary.writePoints.mockImplementation(async () => {
			entered.release();
			await release.promise;
		});
		const original = primary.writePoints;
		storage.registerPlugin('primary', primary);
		const previous = values.writeStrict(property, 10);
		let queued: Promise<boolean> | undefined;
		const publication = new ControllerPublicationContext(() => true);
		try {
			await entered.promise;
			primary.isAvailable.mockReturnValue(false);
			queued = publication.run(() => values.write(property, 20));
			storage.registerPlugin('primary', successor);
			release.release();
			await previous;
			expect(await queued).toBe(true);
			expect(cached(values).value).toBe(20);
			expect(original).toHaveBeenCalledTimes(1);
			expect(successor.writePoints).not.toHaveBeenCalled();
			expect(publication.facts().some((fact) => fact.name.startsWith('storage.'))).toBe(false);
		} finally {
			release.release();
			await Promise.allSettled([previous, ...(queued !== undefined ? [queued] : [])]);
			await storage.onApplicationShutdown();
		}
	});

	it.each(originalFailures)('keeps a captured connection failure %s outside history best effort', async (cause) => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary');
		storage.registerPlugin('primary', primary);
		primary.isAvailable.mockImplementation(() => failOriginal(cause));
		const publication = new ControllerPublicationContext(() => true);
		try {
			await expect(publication.run(() => values.write(property, 20))).rejects.toBe(cause);
			expect(cached(values).value).toBe(20);
			expect(primary.writePoints).not.toHaveBeenCalled();
			const failed = publication.facts().find((fact) => fact.name === 'property.value');
			expect(failed).toMatchObject({ submitted: true, settled: true, failed: true });
			expect(Object.hasOwn(failed.failure, 'cause')).toBe(true);
			expect(failed.failure.cause).toBe(cause);
		} finally {
			await storage.onApplicationShutdown();
		}
	});

	it.each(originalFailures)('keeps captured history preparation failure %s best effort', async (cause) => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary'),
			fallback = createPlugin('memory');
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('memory', fallback);
		fallback.isAvailable.mockImplementation(() => failOriginal(cause));
		const capture = storage.captureControllerWrite.bind(storage) as StorageService['captureControllerWrite'];
		let observed: ReturnType<StorageService['captureControllerWrite']> | undefined;
		const observer = jest.spyOn(storage, 'captureControllerWrite').mockImplementation((points) => {
			const original = capture(points);
			observed = original;
			return original;
		});
		const publication = new ControllerPublicationContext(() => true);
		try {
			await expect(publication.run(() => values.write(property, 20))).resolves.toBe(true);
			expect(observer).toHaveBeenCalledTimes(1);
			const original = observed.write();
			expect(observed.write()).toBe(original);
			await expect(original).rejects.toBe(cause);
			expect(cached(values).value).toBe(20);
			expect(primary.isAvailable).toHaveBeenCalledTimes(1);
			expect(fallback.isAvailable).toHaveBeenCalledTimes(1);
			expect(primary.writePoints).not.toHaveBeenCalled();
			expect(fallback.writePoints).not.toHaveBeenCalled();
			expect(publication.facts().some((fact) => fact.name.startsWith('storage.'))).toBe(false);
		} finally {
			observer.mockRestore();
			await storage.onApplicationShutdown();
		}
	});

	it.each(originalFailures)(
		'retains each original role failure %s without retry or suppressing its peer',
		async (cause) => {
			for (const role of ['primary', 'fallback'] as const) {
				const { storage, values, property } = propertyFixture();
				const primary = createPlugin('primary'),
					fallback = createPlugin('memory');
				storage.registerPlugin('primary', primary);
				storage.registerPlugin('memory', fallback);
				(role === 'primary' ? primary : fallback).writePoints.mockRejectedValue(cause);
				const publication = new ControllerPublicationContext(() => true);
				try {
					await expect(publication.run(() => values.write(property, 20))).resolves.toBe(true);
					expect(primary.writePoints).toHaveBeenCalledTimes(1);
					expect(fallback.writePoints).toHaveBeenCalledTimes(1);
					const failed = publication.facts().find((fact) => fact.name === `storage.${role}`);
					expect(failed).toMatchObject({ submitted: true, settled: true, failed: true });
					expect(Object.hasOwn(failed.failure, 'cause')).toBe(true);
					expect(failed.failure.cause).toBe(cause);
				} finally {
					await storage.onApplicationShutdown();
				}
			}
		},
	);

	it.each(['null', 'sentinel', 'invalid', 'unsupported', 'unchanged', 'projection'] as const)(
		'discards captured errors for an owned %s no-history decision',
		async (kind) => {
			const { storage, values, property, registry } = propertyFixture();
			const primary = createPlugin('primary');
			storage.registerPlugin('primary', primary);
			if (kind === 'unchanged') await values.writeWithState(property, 20);
			primary.writePoints.mockClear();
			primary.isAvailable.mockImplementation(() => failOriginal(0));
			property.invalid = '-1';
			if (kind === 'unsupported') property.dataType = 'unsupported' as DataTypeType;
			if (kind === 'projection')
				expect(registry.register({ getType: () => property.type, resolve: () => 'other-series' })).toBe(true);
			const value = kind === 'null' ? null : kind === 'sentinel' ? -1 : kind === 'invalid' ? 200 : 20;
			const publication = new ControllerPublicationContext(() => true);
			try {
				await expect(
					publication.run(() => values.write(property, value, kind === 'unchanged' ? undefined : new Date(NaN))),
				).resolves.toBe(false);
				expect(primary.writePoints).not.toHaveBeenCalled();
				expect(publication.facts().some((fact) => fact.name.startsWith('storage.'))).toBe(false);
			} finally {
				await storage.onApplicationShutdown();
			}
		},
	);

	it('discards captured history faults for a real producer-owned property', async () => {
		const { storage, property, registry, lock } = propertyFixture();
		const producers = new PropertyProducerRegistryService();
		producers.register(property, 1);
		const values = new PropertyValueService(storage, registry, lock, producers);
		const primary = createPlugin('primary');
		storage.registerPlugin('primary', primary);
		primary.isAvailable.mockImplementation(() => failOriginal(0));
		try {
			await expect(new ControllerPublicationContext(() => true).run(() => values.write(property, 20))).resolves.toBe(
				false,
			);
			expect(primary.writePoints).not.toHaveBeenCalled();
			expect(cached(values)).toBeUndefined();
		} finally {
			await storage.onApplicationShutdown();
		}
	});

	it.each([false, true])('retains invalid Date failure at the original unchanged=%s boundary', async (unchanged) => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary');
		storage.registerPlugin('primary', primary);
		if (unchanged) await values.writeWithState(property, 20);
		primary.writePoints.mockClear();
		primary.isAvailable.mockImplementation(() => failOriginal(0));
		try {
			await expect(
				new ControllerPublicationContext(() => true).run(() => values.write(property, 20, new Date(NaN))),
			).rejects.toBeInstanceOf(RangeError);
			expect(primary.writePoints).not.toHaveBeenCalled();
			expect(cached(values)?.value).toBe(unchanged ? 20 : undefined);
		} finally {
			await storage.onApplicationShutdown();
		}
	});

	it.each([false, true])('pins changed history time but retains delayed unchanged=%s refresh', async (unchanged) => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary');
		const entered = gate(),
			release = gate();
		const start = new Date('2026-01-01T00:00:00.000Z'),
			later = new Date('2026-01-01T00:00:10.000Z');
		let calls = 0;
		const points: StoragePoint[][] = [];
		primary.writePoints.mockImplementation(async (batch) => {
			points.push(structuredClone(batch));
			if (++calls === 1) {
				entered.release();
				await release.promise;
			}
		});
		storage.registerPlugin('primary', primary);
		jest.useFakeTimers({
			now: start,
			doNotFake: [
				'hrtime',
				'nextTick',
				'performance',
				'queueMicrotask',
				'setImmediate',
				'clearImmediate',
				'setInterval',
				'clearInterval',
				'setTimeout',
				'clearTimeout',
			],
		});
		const previous = values.writeStrict(property, unchanged ? 20 : 10);
		let queued: Promise<boolean> | undefined;
		try {
			await entered.promise;
			queued = new ControllerPublicationContext(() => true).run(() => values.write(property, 20));
			jest.setSystemTime(later);
			release.release();
			await previous;
			expect(await queued).toBe(!unchanged);
			expect(cached(values).lastUpdated).toBe((unchanged ? later : start).toISOString());
			expect(points).toHaveLength(unchanged ? 1 : 2);
			expect(points[points.length - 1][0].timestamp).toEqual(start);
		} finally {
			release.release();
			await Promise.allSettled([previous, ...(queued !== undefined ? [queued] : [])]);
			try {
				await storage.onApplicationShutdown();
			} finally {
				jest.useRealTimers();
			}
		}
	});

	it('invokes retained methods directly without consulting their own call metadata', async () => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary');
		storage.registerPlugin('primary', primary);
		let touched = 0;
		for (const method of [primary.writePoints, primary.isAvailable]) {
			Object.defineProperty(method, 'call', {
				get: () => {
					touched++;
					throw new Error('replacement call getter');
				},
			});
		}
		try {
			await expect(new ControllerPublicationContext(() => true).run(() => values.write(property, 20))).resolves.toBe(
				true,
			);
			expect(primary.writePoints).toHaveBeenCalledTimes(1);
			expect(primary.isAvailable).toHaveBeenCalledTimes(2);
			expect(touched).toBe(0);
		} finally {
			await storage.onApplicationShutdown();
		}
	});

	it('does not execute a history accessor or promote optional diagnostic failure', async () => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary'),
			fallback = createPlugin('memory');
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('memory', fallback);
		let accessed = 0;
		Object.defineProperty(fallback, 'writePoints', {
			configurable: true,
			get: () => {
				accessed++;
				return primary.writePoints;
			},
		});
		const propertyLogger = Object.getOwnPropertyDescriptor(values, 'logger');
		Object.defineProperty(values, 'logger', {
			...propertyLogger,
			value: {
				error: () => {
					throw new Error('optional diagnostics failed');
				},
			},
		});
		try {
			await expect(new ControllerPublicationContext(() => true).run(() => values.write(property, 20))).resolves.toBe(
				true,
			);
			expect(accessed).toBe(0);
			expect(primary.writePoints).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(values, 'logger', propertyLogger);
			await storage.onApplicationShutdown();
		}
	});

	it('does not let error getters or optional logger failures suppress the original peer', async () => {
		const { storage, values, property } = propertyFixture();
		const primary = createPlugin('primary'),
			fallback = createPlugin('memory');
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('memory', fallback);
		const reason = new Error('original callback reason');
		Object.defineProperty(reason, 'message', {
			get: () => {
				throw new Error('unsafe diagnostic getter');
			},
		});
		fallback.writePoints.mockRejectedValue(reason);
		const originalLogger = Object.getOwnPropertyDescriptor(storage, 'logger');
		Object.defineProperty(storage, 'logger', {
			...originalLogger,
			value: {
				warn: () => {
					throw new Error('optional logger failed');
				},
			},
		});
		const publication = new ControllerPublicationContext(() => true);
		try {
			await expect(publication.run(() => values.write(property, 21))).resolves.toBe(true);
			expect(primary.writePoints).toHaveBeenCalledTimes(1);
			expect(publication.facts().find((fact) => fact.name === 'storage.fallback')?.failure?.cause).toBe(reason);
		} finally {
			Object.defineProperty(storage, 'logger', originalLogger);
			await storage.onApplicationShutdown();
		}
	});

	it.each([undefined, null, false, 0, ''])(
		'preserves owned strict rejection %s and still permits an available fallback',
		async (cause) => {
			for (const available of [false, true]) {
				const storage = new StorageService({
					getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'memory' }),
				} as unknown as ConfigService);
				const primary = createPlugin('primary'),
					fallback = createPlugin('memory');
				primary.query.mockRejectedValue(cause);
				fallback.isAvailable.mockReturnValue(available);
				fallback.query.mockResolvedValue([{ original: true }]);
				storage.registerPlugin('primary', primary);
				storage.registerPlugin('memory', fallback);
				const read = new ControllerPublicationContext(() => true).run(() => storage.queryStrict('SELECT original'));
				if (available) await expect(read).resolves.toEqual([{ original: true }]);
				else await expect(read).rejects.toBe(cause);
				expect(primary.query).toHaveBeenCalledTimes(1);
				expect(fallback.query).toHaveBeenCalledTimes(available ? 1 : 0);
			}
		},
	);
	it.each([undefined, null, false, 0, ''])(
		'keeps required owned persistence successful after optional mirror rejects %s',
		async (cause) => {
			const storage = new StorageService({
				getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'memory' }),
			} as unknown as ConfigService);
			const primary = createPlugin('primary'),
				fallback = createPlugin('memory');
			primary.writePoints.mockResolvedValue(undefined);
			fallback.writePoints.mockRejectedValue(cause);
			storage.registerPlugin('primary', primary);
			storage.registerPlugin('memory', fallback);
			const publication = new ControllerPublicationContext(() => true);
			await expect(publication.run(() => storage.writePointsStrict([]))).resolves.toBeUndefined();
			expect(primary.writePoints).toHaveBeenCalledTimes(1);
			expect(fallback.writePoints).toHaveBeenCalledTimes(1);
			expect(publication.facts()).toContainEqual(
				expect.objectContaining({ name: 'storage.strict.mirror', failed: true }),
			);
		},
	);
	it.each([false, true])(
		'owned strict=%s fallback reads retain original methods, receiver and options',
		async (strict) => {
			const storage = new StorageService({
				getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'memory' }),
			} as unknown as ConfigService);
			const primary = createPlugin('primary'),
				fallback = createPlugin('memory');
			storage.registerPlugin('memory', fallback);
			storage.registerPlugin('primary', primary);
			let reject: (cause: unknown) => void;
			const held = new Promise<unknown[]>((_resolve, fail) => {
				reject = fail;
			});
			primary.query.mockReturnValue(held);
			fallback.query.mockResolvedValue([{ original: true }]);
			const originalQuery = fallback.query;
			const options: StorageQueryOptions = { database: 'original', retentionPolicy: 'full', precision: 'ms' };
			const publication = new ControllerPublicationContext(() => true);
			const operation = publication.run(() =>
				strict ? storage.queryStrict('SELECT original', options) : storage.query('SELECT original', options),
			);
			const successor = createPlugin('memory');
			try {
				await storage.unregisterPlugin('memory');
				storage.registerPlugin('memory', successor);
				fallback.query = successor.query;
				options.database = 'successor';
				options.precision = 's';
			} finally {
				reject(new Error('original primary failed'));
			}
			expect(await operation).toEqual([{ original: true }]);
			expect(originalQuery).toHaveBeenCalledWith('SELECT original', {
				database: 'original',
				retentionPolicy: 'full',
				precision: 'ms',
			});
			expect(originalQuery.mock.contexts[0]).toBe(fallback);
			expect(successor.query).not.toHaveBeenCalled();
			expect(publication.facts()).toEqual([
				expect.objectContaining({ name: 'storage.read.primary', submitted: true, settled: true, failed: true }),
				expect.objectContaining({ name: 'storage.read.fallback', submitted: true, settled: true, failed: false }),
			]);
		},
	);

	it('joins original publication work after releasing its structural owner and preserves falsy callback failure', async () => {
		const structure = new DeviceStructureLockService();
		let start: () => void;
		let invoked = false;
		const fail = (cause: unknown): never => {
			throw cause;
		};
		const startOriginal = new Promise<void>((resolve) => {
			start = resolve;
		});
		// This original job was queued by an independent listener pass, outside the publishing owner.
		const original = (async () => {
			await startOriginal;
			await structure.runExclusive(async () => {
				invoked = true;
				await Promise.resolve();
			});
		})();
		const publication = new ControllerPublicationContext(() => false);
		const work = ControllerPublicationContext.complete(() =>
			structure.runExclusive(() =>
				publication.run(async () => {
					void ControllerPublicationContext.effect('original.index.pass', () => original);
					start();
					expect(invoked).toBe(false);
					await Promise.resolve();
					fail(0);
				}),
			),
		);
		await expect(work).rejects.toBe(0);
		expect(invoked).toBe(true);
		expect(publication.facts()).toEqual([
			{ name: 'original.index.pass', submitted: true, settled: true, failed: false, retired: true },
		]);
	});

	it.each([
		['single', false],
		['single', true],
		['batch', false],
		['batch', true],
	] as const)('preserves original owned %s status query outcomes with strict=%s', async (kind, strict) => {
		const diagnosticFailure = new Error('optional status diagnostic failed');
		const unreadableFailure = new Error('original unreadable status query failure');
		Object.defineProperty(unreadableFailure, 'message', { get: () => failOriginal(diagnosticFailure) });
		const loggerFailure = new Error('original query failure with a broken logger');
		for (const cause of [...originalFailures, unreadableFailure, loggerFailure]) {
			const storage = propertyFixture().storage;
			const primary = createPlugin('primary'),
				fallback = createPlugin('memory');
			primary.query.mockRejectedValue(cause);
			fallback.query.mockRejectedValue(cause);
			storage.registerPlugin('primary', primary);
			storage.registerPlugin('memory', fallback);
			const statuses = new DeviceConnectionStateService(storage);
			const diagnostic = jest.fn();
			if (cause === loggerFailure) diagnostic.mockImplementation(() => failOriginal(diagnosticFailure));
			Object.defineProperty(statuses, 'logger', { value: { debug: jest.fn(), error: diagnostic } });
			const publication = new ControllerPublicationContext(() => true);
			const device = { id: 'original-device' };
			const read = publication.run(async () => {
				if (kind === 'single') return strict ? statuses.readLatestStrict(device) : statuses.readLatest(device);
				const results = strict
					? await statuses.readLatestManyStrict([device])
					: await statuses.readLatestMany([device]);
				return results.get(device.id);
			});
			if (strict) await expect(read).rejects.toBe(cause);
			else
				await expect(read).resolves.toEqual({
					online: false,
					status: ConnectionState.UNKNOWN,
					lastChanged: null,
				});
			expect(primary.query).toHaveBeenCalledTimes(1);
			expect(fallback.query).toHaveBeenCalledTimes(1);
			if (cause === loggerFailure) expect(diagnostic).toHaveBeenCalledTimes(1);
			for (const fact of publication.facts()) {
				expect(fact).toMatchObject({ submitted: true, settled: true, failed: true });
				expect(fact.failure?.cause).toBe(cause);
			}
			expect(publication.facts()).toHaveLength(2);
		}
	});

	it.each(['single', 'batch'] as const)(
		'qualifies original %s device-status read health before cache promotion',
		async (kind) => {
			for (const fault of ['none', 'retired', 'unavailable', 'reregistered'] as const) {
				const storage = new StorageService({
					getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary' }),
				} as unknown as ConfigService);
				const plugin = createPlugin('primary');
				let deliver: (rows: unknown[]) => void;
				let started: () => void;
				const entered = new Promise<void>((resolve) => {
					started = resolve;
				});
				plugin.query.mockImplementation(() => {
					started();
					return new Promise((resolve) => {
						deliver = resolve;
					});
				});
				storage.registerPlugin('primary', plugin);
				const statuses = new DeviceConnectionStateService(storage);
				let current = true;
				const publication = new ControllerPublicationContext(() => current);
				const device = { id: 'original-device' };
				const read = publication.run(async () =>
					kind === 'single'
						? statuses.readLatest(device)
						: (await statuses.readLatestMany([device])).get('original-device'),
				);
				await entered;
				device.id = 'different-device';
				if (fault === 'retired') current = false;
				if (fault === 'unavailable') plugin.isAvailable.mockReturnValue(false);
				if (fault === 'reregistered') {
					await storage.unregisterPlugin('primary');
					storage.registerPlugin('primary', plugin);
				}
				deliver([
					{
						deviceId: 'original-device',
						propertyId: 'original-status',
						onlineI: 1,
						status: ConnectionState.CONNECTED,
						time: '2026-01-01T00:00:00Z',
					},
				]);
				expect(await read).toMatchObject({
					status: fault === 'none' ? ConnectionState.CONNECTED : ConnectionState.UNKNOWN,
				});
				plugin.isAvailable.mockReturnValue(true);
				plugin.query.mockResolvedValue([]);
				const after = await statuses.readLatest({ id: 'original-device' });
				expect(after.status).toBe(fault === 'none' ? ConnectionState.CONNECTED : ConnectionState.UNKNOWN);
				expect(plugin.query).toHaveBeenCalledTimes(fault === 'none' ? 1 : 2);
			}
		},
	);

	it.each([
		['best effort', 'replacement'],
		['best effort', 'getter'],
		['strict', 'replacement'],
		['strict', 'getter'],
	])('retains direct owned %s callbacks across held-role call metadata %s', async (mode, metadata) => {
		const storage = propertyFixture().storage;
		const primary = createPlugin('primary'),
			fallback = createPlugin('memory'),
			successor = createPlugin('successor');
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('memory', fallback);
		const first = mode === 'strict' ? primary : fallback;
		const target = mode === 'strict' ? fallback : primary;
		const entered = gate(),
			release = gate();
		const receivers: StoragePlugin[] = [];
		first.writePoints.mockImplementation(async (points) => {
			points[0].fields.numberValue = 99;
			entered.release();
			await release.promise;
		});
		target.writePoints.mockImplementation(function (this: StoragePlugin) {
			receivers.push(this);
			return Promise.resolve();
		});
		let eligible = true;
		const publication = new ControllerPublicationContext(() => eligible);
		const point = {
			measurement: 'property_value',
			fields: { numberValue: 20 },
			timestamp: new Date('2026-01-01T00:00:00Z'),
		};
		const work = publication.run(() =>
			mode === 'strict' ? storage.writePointsStrict([point]) : storage.writePoints([point]),
		);
		const descriptor = Object.getOwnPropertyDescriptor(target.writePoints, 'call');
		try {
			await entered.promise;
			Object.defineProperty(
				target.writePoints,
				'call',
				metadata === 'getter'
					? {
							configurable: true,
							get: () => {
								throw new Error('late call getter');
							},
						}
					: {
							configurable: true,
							value: (_receiver: unknown, points: StoragePoint[]) => successor.writePoints(points),
						},
			);
			point.fields.numberValue = 30;
			eligible = false;
			release.release();
			await expect(work).resolves.toBeUndefined();
			expect(first.writePoints).toHaveBeenCalledTimes(1);
			expect(target.writePoints).toHaveBeenCalledTimes(1);
			expect(receivers).toEqual([target]);
			expect(target.writePoints).toHaveBeenCalledWith([
				{ measurement: 'property_value', fields: { numberValue: 20 }, timestamp: new Date('2026-01-01T00:00:00Z') },
			]);
			expect(successor.writePoints).not.toHaveBeenCalled();
			expect(publication.facts()).toEqual([
				expect.objectContaining({ submitted: true, settled: true, failed: false, retired: true }),
				expect.objectContaining({ submitted: true, settled: true, failed: false, retired: true }),
			]);
		} finally {
			release.release();
			await Promise.allSettled([work]);
			if (descriptor) Object.defineProperty(target.writePoints, 'call', descriptor);
			else Reflect.deleteProperty(target.writePoints, 'call');
			await storage.onApplicationShutdown();
		}
	});

	it.each(['message getter', 'string conversion', 'logger'])(
		'keeps the direct owned primary owed despite fallback diagnostic %s failure',
		async (fault) => {
			const storage = propertyFixture().storage;
			const primary = createPlugin('primary'),
				fallback = createPlugin('memory');
			storage.registerPlugin('primary', primary);
			storage.registerPlugin('memory', fallback);
			const failure = fault === 'string conversion' ? {} : new Error('original fallback error');
			const formattingFailure = new Error('optional diagnostic failure');
			if (fault === 'message getter') {
				Object.defineProperty(failure, 'message', { get: () => failOriginal(formattingFailure) });
			} else if (fault === 'string conversion') {
				Object.defineProperty(failure, Symbol.toPrimitive, { value: () => failOriginal(formattingFailure) });
			}
			fallback.writePoints.mockRejectedValue(failure);
			primary.writePoints.mockResolvedValue();
			const logger = Reflect.get(storage, 'logger') as { warn: (message: string) => void };
			const observer =
				fault === 'logger'
					? jest.spyOn(logger, 'warn').mockImplementation(() => failOriginal(formattingFailure))
					: undefined;
			const publication = new ControllerPublicationContext(() => true);
			const point = { measurement: 'property_value', fields: { numberValue: 20 } };
			try {
				await expect(publication.run(() => storage.writePoints([point]))).resolves.toBeUndefined();
				expect(fallback.writePoints).toHaveBeenCalledTimes(1);
				expect(primary.writePoints).toHaveBeenCalledTimes(1);
				expect(primary.writePoints).toHaveBeenCalledWith([point]);
				const facts = publication.facts();
				expect(facts[0]).toMatchObject({ name: 'storage.fallback', settled: true, failed: true });
				expect(Object.hasOwn(facts[0].failure, 'cause')).toBe(true);
				expect(facts[0].failure.cause).toBe(failure);
				expect(facts[1]).toMatchObject({ name: 'storage.primary', settled: true, failed: false });
			} finally {
				observer?.mockRestore();
				await storage.onApplicationShutdown();
			}
		},
	);

	it.each([
		['property', 'replacement'],
		['property', 'getter'],
		['status single', 'replacement'],
		['status single', 'getter'],
		['status batch', 'replacement'],
		['status batch', 'getter'],
	])('checks original %s read health despite held-query call metadata %s', async (kind, metadata) => {
		const { storage, values, property } = propertyFixture();
		const plugin = createPlugin('primary');
		let available = true,
			callAccesses = 0;
		const receivers: StoragePlugin[] = [];
		plugin.isAvailable.mockImplementation(function (this: StoragePlugin) {
			receivers.push(this);
			return available;
		});
		const entered = gate(),
			release = gate();
		plugin.query.mockImplementation(async () => {
			entered.release();
			await release.promise;
			return [
				kind === 'property'
					? { propertyId: 'setting', numberValue: 20, time: '2026-01-01T00:00:00Z' }
					: {
							deviceId: 'original-device',
							propertyId: 'original-status',
							onlineI: 1,
							status: ConnectionState.CONNECTED,
							time: '2026-01-01T00:00:00Z',
						},
			];
		});
		storage.registerPlugin('primary', plugin);
		const statuses = new DeviceConnectionStateService(storage);
		const device = { id: 'original-device' };
		const publication = new ControllerPublicationContext(() => true);
		const read = publication.run(async () =>
			kind === 'property'
				? values.readLatest(property)
				: kind === 'status single'
					? statuses.readLatest(device)
					: (await statuses.readLatestMany([device])).get(device.id),
		);
		const descriptor = Object.getOwnPropertyDescriptor(plugin.isAvailable, 'call');
		try {
			await entered.promise;
			const callsAtEntry = plugin.isAvailable.mock.calls.length;
			available = false;
			Object.defineProperty(plugin.isAvailable, 'call', {
				configurable: true,
				...(metadata === 'getter'
					? {
							get: () => {
								callAccesses++;
								throw new Error('replacement call getter');
							},
						}
					: {
							value: () => {
								callAccesses++;
								return true;
							},
						}),
			});
			release.release();
			const result = await read;
			if (kind === 'property') {
				expect(result).toBeNull();
				expect(cached(values)).toBeUndefined();
				expect((Reflect.get(values, 'recentValuesMap') as Map<string, unknown>).has('setting')).toBe(false);
				expect((Reflect.get(values, 'cacheVersions') as Map<string, unknown>).has('setting')).toBe(false);
			} else {
				expect(result).toMatchObject({ status: ConnectionState.UNKNOWN });
				expect((Reflect.get(statuses, 'statusMap') as Map<string, unknown>).has(device.id)).toBe(false);
			}
			expect(callAccesses).toBe(0);
			expect(plugin.isAvailable.mock.calls.length).toBeGreaterThan(callsAtEntry);
			expect(receivers.every((receiver) => receiver === plugin)).toBe(true);
			if (descriptor) Object.defineProperty(plugin.isAvailable, 'call', descriptor);
			else Reflect.deleteProperty(plugin.isAvailable, 'call');
			available = true;
			plugin.query.mockResolvedValue([]);
			if (kind === 'property') expect(await values.readLatest(property)).toBeNull();
			else expect(await statuses.readLatest(device)).toMatchObject({ status: ConnectionState.UNKNOWN });
			expect(plugin.query).toHaveBeenCalledTimes(2);
		} finally {
			release.release();
			await Promise.allSettled([read]);
			if (descriptor) Object.defineProperty(plugin.isAvailable, 'call', descriptor);
			else Reflect.deleteProperty(plugin.isAvailable, 'call');
			await storage.onApplicationShutdown();
		}
	});

	it('preserves the original strict mirror callback and immutable bytes after required persistence loses eligibility', async () => {
		const storage = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary'),
			fallback = createPlugin('fallback'),
			successor = createPlugin('fallback');
		let finish: () => void;
		let started: () => void;
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		primary.writePoints.mockImplementation((points) => {
			points[0].fields.value = 'mutated by primary';
			started();
			return new Promise((resolve) => {
				finish = resolve;
			});
		});
		fallback.writePoints.mockResolvedValue();
		storage.registerPlugin('primary', primary);
		storage.registerPlugin('fallback', fallback);
		let eligible = true;
		const context = new ControllerPublicationContext(() => eligible);
		const points = [{ measurement: 'property_value', fields: { value: 'original' }, BLOB: Buffer.from([7, 0, 255]) }];
		const task = context.run(() => storage.writePointsStrict(points));
		await entered;
		await storage.unregisterPlugin('fallback');
		storage.registerPlugin('fallback', successor);
		points[0].BLOB[0] = 0;
		eligible = false;
		finish();
		await task;
		expect(fallback.writePoints).toHaveBeenCalledWith([
			{ measurement: 'property_value', fields: { value: 'original' }, BLOB: Buffer.from([7, 0, 255]) },
		]);
		expect(successor.writePoints).not.toHaveBeenCalled();
		expect(context.facts()).toEqual([
			expect.objectContaining({ name: 'storage.strict.required', settled: true, failed: false, retired: true }),
			expect.objectContaining({ name: 'storage.strict.mirror', settled: true, failed: false, retired: true }),
		]);
	});

	it('keeps original destinations and complete detached point bytes while an owned fallback is held', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		const successor = createPlugin('primary');
		primary.writePoints.mockResolvedValue();
		successor.writePoints.mockResolvedValue();
		let release: () => void;
		let started: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		fallback.writePoints.mockImplementation(async (points) => {
			points[0].fields.numberValue = 99;
			started();
			await held;
		});
		service.registerPlugin('primary', primary);
		service.registerPlugin('fallback', fallback);
		const point = {
			measurement: 'property_value',
			tags: { propertyId: 'original' },
			fields: { numberValue: 20 },
			timestamp: new Date('2026-01-01T00:00:00Z'),
			DATA: { unknown: null },
			BLOB: Buffer.from([0, 255, 7]),
		};
		let eligible = true;
		const publication = new ControllerPublicationContext(() => eligible);
		const work = publication.run(() => service.writePoints([point]));
		await entered;
		await service.unregisterPlugin('primary');
		service.registerPlugin('primary', successor);
		point.fields.numberValue = 30;
		point.tags.propertyId = 'successor';
		point.timestamp.setFullYear(2030);
		point.BLOB.fill(42);
		eligible = false;
		release();
		await work;
		expect(primary.writePoints).toHaveBeenCalledWith([
			{
				measurement: 'property_value',
				tags: { propertyId: 'original' },
				fields: { numberValue: 20 },
				timestamp: new Date('2026-01-01T00:00:00Z'),
				DATA: { unknown: null },
				BLOB: Buffer.from([0, 255, 7]),
			},
		]);
		expect(successor.writePoints).not.toHaveBeenCalled();
		expect(publication.facts()).toEqual([
			{ name: 'storage.fallback', submitted: true, settled: true, failed: false, retired: true },
			{ name: 'storage.primary', submitted: true, settled: true, failed: false, retired: true },
		]);
	});

	it('uses fallback persistence when the primary backend is unavailable', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		const point = { measurement: 'property_value', fields: { numberValue: 42 } };
		primary.isAvailable.mockReturnValue(false);
		fallback.writePoints.mockResolvedValue();
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(service.writePointsStrict([point])).resolves.toBeUndefined();
		expect(primary.writePoints).not.toHaveBeenCalled();
		expect(fallback.writePoints).toHaveBeenCalledWith([point]);
	});

	it('rejects a strict write without touching fallback when the active primary fails', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.writePoints.mockRejectedValue(new Error('primary unavailable'));
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(
			service.writePointsStrict([{ measurement: 'property_value', fields: { numberValue: 42 } }]),
		).rejects.toThrow('primary unavailable');
		expect(fallback.writePoints).not.toHaveBeenCalled();
	});

	it('rejects a strict write when no backend is available', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);

		await expect(
			service.writePointsStrict([{ measurement: 'property_value', fields: { numberValue: 42 } }]),
		).rejects.toThrow('No storage backend is available');
	});

	it('propagates a primary strict query failure when no fallback is available', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const storageError = new Error('primary unavailable');
		primary.query.mockRejectedValue(storageError);
		service.registerPlugin(primary.name, primary);

		await expect(service.queryStrict('SELECT * FROM test')).rejects.toBe(storageError);
	});

	it('uses the fallback after a primary strict query failure', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.query.mockRejectedValue(new Error('primary unavailable'));
		fallback.query.mockResolvedValue([{ value: 42 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(service.queryStrict<{ value: number }>('SELECT * FROM test')).resolves.toEqual([{ value: 42 }]);
	});

	it('uses adapter strict queries so fail-open plugins can expose backend errors', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.query.mockResolvedValue([]);
		primary.queryStrict = jest.fn().mockRejectedValue(new Error('database not found'));
		fallback.query.mockResolvedValue([{ value: 42 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(service.queryStrict<{ value: number }>('SELECT * FROM test')).resolves.toEqual([{ value: 42 }]);
		expect(primary.queryStrict).toHaveBeenCalledTimes(1);
		expect(primary.query).not.toHaveBeenCalled();
	});

	it('fails an active-backend query closed when the available primary rejects', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		const primaryError = new Error('primary unavailable');
		primary.queryStrict = jest.fn().mockRejectedValue(primaryError);
		fallback.query.mockResolvedValue([{ value: 41 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(service.queryActiveStrict('SELECT * FROM test')).rejects.toBe(primaryError);
		expect(fallback.query).not.toHaveBeenCalled();
	});

	it('uses fallback for an active-backend query only when primary is unavailable', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.isAvailable.mockReturnValue(false);
		fallback.query.mockResolvedValue([{ value: 42 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		await expect(service.queryActiveStrict<{ value: number }>('SELECT * FROM test')).resolves.toEqual([{ value: 42 }]);
		expect(primary.query).not.toHaveBeenCalled();
	});

	it('binds a reconciliation write to the backend that supplied its strict read', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.isAvailable.mockReturnValue(false);
		fallback.query.mockResolvedValue([{ value: 41 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);

		const result = await service.queryActiveStrictBound<{ value: number }>('SELECT * FROM test');
		primary.isAvailable.mockReturnValue(true);

		await service.writePointsStrict([{ measurement: 'property_value', fields: { numberValue: 42 } }], result.binding);

		expect(result.rows).toEqual([{ value: 41 }]);
		expect(fallback.writePoints).toHaveBeenCalledTimes(1);
		expect(primary.writePoints).not.toHaveBeenCalled();
	});

	it('best-effort mirrors a primary-bound write to the fallback that was healthy at read time', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		primary.query.mockResolvedValue([{ value: 41 }]);
		fallback.writePoints.mockRejectedValue(new Error('fallback unavailable'));
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);
		const { binding } = await service.queryActiveStrictBound('SELECT * FROM test');
		const points = [{ measurement: 'property_value', fields: { numberValue: 42 } }];

		await expect(service.writePointsStrict(points, binding)).resolves.toBeUndefined();

		expect(primary.writePoints).toHaveBeenCalledWith(points);
		expect(fallback.writePoints).toHaveBeenCalledWith(points);
	});

	it('rejects a bound write after the queried backend is replaced', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		primary.query.mockResolvedValue([]);
		service.registerPlugin(primary.name, primary);
		const { binding } = await service.queryActiveStrictBound('SELECT * FROM test');

		await service.unregisterPlugin(primary.name);

		await expect(
			service.writePointsStrict([{ measurement: 'property_value', fields: { numberValue: 42 } }], binding),
		).rejects.toThrow('Bound storage backend is no longer available');
		expect(primary.writePoints).not.toHaveBeenCalled();
	});

	it('does not start a fallback query after the primary request is aborted', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
		const primary = createPlugin('primary');
		const fallback = createPlugin('fallback');
		const controller = new AbortController();
		const abortError = new Error('query deadline exceeded');
		primary.queryStrict = jest.fn().mockImplementation(
			(_query: string, options?: StorageQueryOptions) =>
				new Promise((_, reject) => {
					const signal = options?.signal;

					signal?.addEventListener(
						'abort',
						() => reject(signal.reason instanceof Error ? signal.reason : new Error('Storage query aborted')),
						{ once: true },
					);
				}),
		);
		fallback.query.mockResolvedValue([{ value: 42 }]);
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);
		const query = service.queryStrict('SELECT * FROM test', { signal: controller.signal });

		controller.abort(abortError);

		await expect(query).rejects.toBe(abortError);
		expect(fallback.query).not.toHaveBeenCalled();
	});

	it('rejects a strict query when no backend is available', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);

		await expect(service.queryStrict('SELECT * FROM test')).rejects.toThrow('No storage backend is available');
	});
});
