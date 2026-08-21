/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '../../config/services/config.service';
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
