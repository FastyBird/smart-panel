import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemLogsReporterService } from './system-logs-reporter.service';

describe('SystemLogsReporterService', () => {
	let logger: { addReporter: ReturnType<typeof vi.fn>; removeReporter: ReturnType<typeof vi.fn> };
	let store: { add: ReturnType<typeof vi.fn> };
	let i18n: { global: { locale: string } };

	beforeEach(() => {
		logger = { addReporter: vi.fn(), removeReporter: vi.fn() };
		store = { add: vi.fn() };
		i18n = { global: { locale: 'en' } };
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('start is idempotent: one reporter, one listener pair, however often it is called', () => {
		const addListener = vi.spyOn(window, 'addEventListener');

		const service = new SystemLogsReporterService(logger as never, store as never, i18n as never);

		service.start();
		service.start();
		service.start();

		expect(logger.addReporter).toHaveBeenCalledTimes(1);
		expect(addListener.mock.calls.filter(([event]) => event === 'beforeunload' || event === 'pagehide')).toHaveLength(2);
	});

	it('start works again after dispose', () => {
		const service = new SystemLogsReporterService(logger as never, store as never, i18n as never);

		service.start();
		service.dispose();
		service.start();

		expect(logger.addReporter).toHaveBeenCalledTimes(2);
		expect(logger.removeReporter).toHaveBeenCalledTimes(1);
	});
});
