import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateStatus } from './useUpdateStatus';

const mockGet = vi.fn();
const mockPost = vi.fn();

// Mirrors useSystemActions.spec.ts: mock the barrel and keep everything else real, only
// swapping useBackend for a stub the tests can drive.
vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: { GET: mockGet, POST: mockPost },
		}),
	};
});

describe('useUpdateStatus', () => {
	beforeEach(() => {
		mockGet.mockReset();
		mockPost.mockReset();
		mockPost.mockResolvedValue({ data: { data: {} }, error: undefined });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('stops a poll that never reaches a terminal status after the absolute deadline', async () => {
		vi.useFakeTimers();

		// each tick answers successfully with a non-terminal status
		mockGet.mockResolvedValue({ data: { data: { status: 'installing', progress_percent: 10 } }, error: undefined });

		const { installUpdate, status } = useUpdateStatus();

		await installUpdate();

		await vi.advanceTimersByTimeAsync(31 * 60 * 1000);

		expect(status.value).toBe('failed');

		// no further requests after the deadline
		const calls = mockGet.mock.calls.length;
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mockGet.mock.calls.length).toBe(calls);

		vi.useRealTimers();
	});

	it('stops the poll once the backend reports a complete status', async () => {
		vi.useFakeTimers();

		mockGet
			.mockResolvedValueOnce({ data: { data: { status: 'installing', progress_percent: 10 } }, error: undefined })
			.mockResolvedValueOnce({ data: { data: { status: 'complete', progress_percent: 100 } }, error: undefined });

		const { installUpdate, status } = useUpdateStatus();

		await installUpdate();

		// two ticks at the 4s poll interval
		await vi.advanceTimersByTimeAsync(8_000);

		expect(status.value).toBe('complete');

		vi.useRealTimers();
	});
});
