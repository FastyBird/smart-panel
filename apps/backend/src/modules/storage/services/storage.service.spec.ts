/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';

import { StorageService } from './storage.service';

describe('StorageService', () => {
	const createPlugin = (name: string): jest.Mocked<StoragePlugin> =>
		({
			name,
			isAvailable: jest.fn().mockReturnValue(true),
			query: jest.fn(),
			registerSchema: jest.fn(),
		}) as unknown as jest.Mocked<StoragePlugin>;

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

	it('rejects a strict query when no backend is available', async () => {
		const service = new StorageService({
			getModuleConfig: jest.fn().mockReturnValue({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
		} as unknown as ConfigService);

		await expect(service.queryStrict('SELECT * FROM test')).rejects.toThrow('No storage backend is available');
	});
});
