/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '../../config/services/config.service';
import { ConnectionState } from '../../devices/devices.constants';
import { ControllerPublicationContext } from '../../devices/services/controller-publication-context';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../devices/services/device-structure-lock.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StorageQueryOptions } from '../storage.types';

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
