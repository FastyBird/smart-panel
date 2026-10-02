import { DataSource } from 'typeorm';

import { TOKEN_USAGE_FLUSH_INTERVAL_MS, TOKEN_USAGE_MAX_PENDING, TokenUsageService } from './token-usage.service';

describe('TokenUsageService', () => {
	let service: TokenUsageService;
	let update: jest.Mock;
	let getRepository: jest.Mock;
	const token = { id: 'token-id', hashedToken: 'credential-hash' };

	beforeEach(() => {
		jest.useFakeTimers({ now: new Date('2026-10-02T10:00:00Z') });
		update = jest.fn().mockResolvedValue({ affected: 1 });
		getRepository = jest.fn().mockReturnValue({ update });
		service = new TokenUsageService({ getRepository } as unknown as DataSource);
	});

	afterEach(async () => {
		await service.beforeApplicationShutdown();
		jest.useRealTimers();
	});

	it('coalesces a request burst without touching ORM and flushes the observation time once per interval', async () => {
		service.onModuleInit();
		for (let i = 0; i < 100; i++) service.record(token);
		expect(getRepository).not.toHaveBeenCalled();
		jest.advanceTimersByTime(500);
		service.record(token);
		const observedAt = new Date();
		await jest.advanceTimersByTimeAsync(TOKEN_USAGE_FLUSH_INTERVAL_MS - 500);
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenNthCalledWith(1, expect.any(Array), { lastUsedAt: observedAt });
		await jest.advanceTimersByTimeAsync(TOKEN_USAGE_FLUSH_INTERVAL_MS);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('serializes flushes and preserves newer observations arriving during a slow write', async () => {
		let finish!: () => void;
		update.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
		service.record(token);
		const first = service.flush();
		jest.advanceTimersByTime(500);
		service.record(token);
		expect(service.flush()).toBe(first);
		expect(update).toHaveBeenCalledTimes(1);
		finish();
		await first;
		await service.flush();
		expect(update).toHaveBeenCalledTimes(2);
		expect(update).toHaveBeenNthCalledWith(2, expect.any(Array), { lastUsedAt: new Date() });
	});

	it('bounds pending identities without evicting or directly persisting existing credentials', async () => {
		for (let i = 0; i < TOKEN_USAGE_MAX_PENDING + 10; i++) service.record({ ...token, id: String(i) });
		jest.advanceTimersByTime(500);
		service.record({ ...token, id: '0' });
		expect(getRepository).not.toHaveBeenCalled();
		await service.flush();
		expect(update).toHaveBeenCalledTimes(TOKEN_USAGE_MAX_PENDING);
		expect(update).toHaveBeenNthCalledWith(1, expect.any(Array), { lastUsedAt: new Date() });
		service.record({ ...token, id: 'new' });
		await service.flush();
		expect(update).toHaveBeenCalledTimes(TOKEN_USAGE_MAX_PENDING + 1);
	});

	it('does not fail auth or retain failed telemetry indefinitely and can persist a later observation', async () => {
		update.mockRejectedValueOnce(new Error('database unavailable'));
		expect(() => service.record(token)).not.toThrow();
		await expect(service.flush()).resolves.toBeUndefined();
		await service.flush();
		expect(update).toHaveBeenCalledTimes(1);
		service.record(token);
		await service.flush();
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('drains both an in-flight snapshot and pending observations before shutdown and stops the timer', async () => {
		service.onModuleInit();
		let finish!: () => void;
		update.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
		service.record(token);
		const first = service.flush();
		jest.advanceTimersByTime(500);
		service.record(token);
		const shutdown = service.beforeApplicationShutdown();
		service.record({ ...token, id: 'too-late' });
		finish();
		await first;
		await shutdown;
		expect(update).toHaveBeenCalledTimes(2);
		await jest.advanceTimersByTimeAsync(TOKEN_USAGE_FLUSH_INTERVAL_MS * 2);
		expect(update).toHaveBeenCalledTimes(2);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('does not move the pending timestamp backwards when the system clock changes', async () => {
		const observedAt = new Date();
		service.record(token);
		jest.setSystemTime(Date.now() - 10_000);
		service.record(token);
		await service.flush();
		expect(update).toHaveBeenNthCalledWith(1, expect.any(Array), { lastUsedAt: observedAt });
	});
});
