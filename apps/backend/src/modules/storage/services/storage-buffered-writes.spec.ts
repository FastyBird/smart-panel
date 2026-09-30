/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';

import { StorageService } from './storage.service';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
};
const plugin = (name: string) =>
	({
		name,
		isAvailable: jest.fn().mockReturnValue(true),
		writePoints: jest.fn().mockResolvedValue(undefined),
		registerSchema: jest.fn(),
	}) as unknown as jest.Mocked<StoragePlugin>;

describe('Buffered storage destinations', () => {
	let service: StorageService;
	beforeEach(() => {
		service = new StorageService({
			getModuleConfig: () => ({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);
	});
	afterEach(async () => service.onApplicationShutdown());

	it.each([
		['primary', false],
		['primary', true],
		['fallback', false],
		['fallback', true],
	] as const)('drains capacity-waiting writes before destroying %s (replacement: %s)', async (name, replace) => {
		const old = plugin(name);
		const replacement = plugin(name);
		const first = deferred();
		const last = deferred();
		old.writePoints.mockImplementation(async (points) => {
			if (points.some((point) => point.fields.numberValue === 0)) await first.promise;
			if (points.some((point) => point.fields.numberValue === 1025)) await last.promise;
		});
		service.registerPlugin(name, old);
		for (let index = 0; index < 1024; index++) {
			await service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: index } });
		}
		const waiting = [1024, 1025].map((numberValue) =>
			service.enqueueWritePoint({ measurement: 'test', fields: { numberValue } }),
		);
		let stopped = false;
		const stop = service.unregisterPlugin(name).then(() => (stopped = true));
		if (replace) service.registerPlugin(name, replacement);
		const next = replace
			? service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: 1026 } })
			: expect(service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: 1026 } })).rejects.toThrow(
					'No available storage backend',
				);
		first.resolve();
		try {
			await Promise.all(waiting);
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(stopped).toBe(false);
			expect(old.writePoints.mock.calls.flatMap(([points]) => points.map((point) => point.fields.numberValue))).toEqual(
				Array.from({ length: 1026 }, (_, index) => index),
			);
		} finally {
			last.resolve();
			await Promise.all([stop, next]);
			await service.flushQueuedWrites();
		}
		if (replace) {
			expect(replacement.writePoints).toHaveBeenCalledWith([
				expect.objectContaining({ fields: { numberValue: 1026 } }),
			]);
		} else {
			expect(replacement.writePoints).not.toHaveBeenCalled();
		}
	});

	it('rejects a new buffered write when no destination is available', async () => {
		await expect(service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: 1 } })).rejects.toThrow(
			'No available storage backend',
		);
	});

	it('captures immutable points and destinations, and drains before unregister completes', async () => {
		const old = plugin('primary');
		const replacement = plugin('primary');
		const gate = deferred();
		old.writePoints.mockImplementationOnce(() => gate.promise);
		service.registerPlugin(old.name, old);
		await service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: 1 } });
		const point = { measurement: 'test', tags: { id: 'old' }, fields: { numberValue: 2 }, timestamp: new Date(1000) };
		await service.enqueueWritePoint(point);
		point.fields.numberValue = 99;
		point.tags.id = 'changed';
		point.timestamp.setTime(99);
		let stopped = false;
		const stop = service.unregisterPlugin(old.name).then(() => (stopped = true));
		service.registerPlugin(replacement.name, replacement);
		await service.enqueueWritePoint({ measurement: 'test', fields: { numberValue: 3 } });
		expect(stopped).toBe(false);
		gate.resolve();
		await stop;
		await service.flushQueuedWrites();
		expect(old.writePoints.mock.calls).toEqual([
			[[expect.objectContaining({ fields: { numberValue: 1 } })]],
			[[expect.objectContaining({ fields: { numberValue: 2 }, tags: { id: 'old' }, timestamp: new Date(1000) })]],
		]);
		expect(replacement.writePoints).toHaveBeenCalledWith([expect.objectContaining({ fields: { numberValue: 3 } })]);
	});

	it('mirrors into fallback before slow primary I/O and continues after a primary failure', async () => {
		const primary = plugin('primary');
		const fallback = plugin('fallback');
		primary.writePoints.mockRejectedValueOnce(new Error('Influx failed'));
		service.registerPlugin(primary.name, primary);
		service.registerPlugin(fallback.name, fallback);
		const point = { measurement: 'test', fields: { stringValue: 'true' } };
		await service.enqueueWritePoint(point);
		await service.flushQueuedWrites();
		expect(fallback.writePoints).toHaveBeenCalledWith([point]);
		await service.enqueueWritePoint(point);
		await service.flushQueuedWrites();
		expect(primary.writePoints).toHaveBeenCalledTimes(2);
		expect(fallback.writePoints).toHaveBeenCalledTimes(2);
	});
});
