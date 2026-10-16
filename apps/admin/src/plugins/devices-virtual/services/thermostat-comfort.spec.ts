import { describe, expect, it, vi } from 'vitest';

import { finiteTemperature, remainingOverrideSeconds, thermostatComfortTransport } from './thermostat-comfort';

describe('comfort display completeness', () => {
	it('keeps zero a valid temperature, refuses false/null/nonfinite values, and never extends an expiry on reread', () => {
		expect(finiteTemperature(0)).toBe(true);
		for (const value of [false, null, undefined, Infinity, NaN, '20']) expect(finiteTemperature(value)).toBe(false);
		const expiry = '2026-10-15T12:00:00Z',
			end = Date.parse(expiry);
		expect(remainingOverrideSeconds(expiry, end - 1000)).toBe(1);
		expect(remainingOverrideSeconds(expiry, end)).toBe(0);
		expect(remainingOverrideSeconds(expiry, end + 1000)).toBe(0);
		expect(remainingOverrideSeconds(null, end)).toBeNull();
	});
});

describe('comfort read revision races', () => {
	const setup = (revisions: number[][], fail = false) => {
		let calls = 0;
		const GET = vi.fn(async (path: string, options: unknown) => {
			expect(options).toHaveProperty('params.path.id', 'a');
			const index = calls++,
				revision = revisions[Math.min(Math.floor(index / 3), revisions.length - 1)][index % 3];
			if (fail) return { error: { message: 'read_unavailable' } };
			return { data: { data: path.endsWith('/runtime') ? { configuration_revision: revision } : { revision } } };
		});
		const POST = vi.fn().mockResolvedValue({ error: { message: 'revision_conflict' } });
		const transport = thermostatComfortTransport({ client: { GET, POST } } as unknown as Parameters<typeof thermostatComfortTransport>[0]);
		return { transport, GET, POST };
	};
	it('retries one complete readonly triplet and accepts only a coherent snapshot', async () => {
		const { transport, GET, POST } = setup([
			[4, 5, 5],
			[5, 5, 5],
		]);
		const signal = new AbortController().signal;
		expect((await transport.read('a', signal)).comfort.revision).toBe(5);
		expect(GET).toHaveBeenCalledTimes(6);
		for (const call of GET.mock.calls) expect(call[1]).toEqual({ params: { path: { id: 'a' } }, signal });
		expect(POST).not.toHaveBeenCalled();
	});
	it('bounds ongoing mismatch to two attempts and does not retry request failures or aborted reads', async () => {
		const race = setup([
			[4, 5, 5],
			[5, 6, 6],
		]);
		await expect(race.transport.read('a')).rejects.toThrow('revision_conflict');
		expect(race.GET).toHaveBeenCalledTimes(6);
		const failure = setup([[4, 4, 4]], true);
		await expect(failure.transport.read('a')).rejects.toThrow('read_unavailable');
		expect(failure.GET).toHaveBeenCalledTimes(3);
		const aborted = setup([[4, 5, 5]]),
			controller = new AbortController();
		controller.abort();
		await expect(aborted.transport.read('a', controller.signal)).rejects.toThrow('revision_conflict');
		expect(aborted.GET).toHaveBeenCalledTimes(3);
	});
	it('never replays a conflicting write', async () => {
		const { transport, GET, POST } = setup([[4, 4, 4]]);
		await expect(
			transport.write('a', { revision: 4, graph_revision: 8 } as Parameters<typeof transport.write>[1], {
				kind: 'selection',
				preset: 'eco',
				clear_user_off: false,
			})
		).rejects.toThrow('revision_conflict');
		expect(POST).toHaveBeenCalledTimes(1);
		expect(GET).not.toHaveBeenCalled();
	});
});
