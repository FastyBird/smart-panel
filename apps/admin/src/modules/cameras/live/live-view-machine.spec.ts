import { describe, expect, it } from 'vitest';

import { LIVE_RETRY_DELAYS_MS } from '../cameras.constants';

import { type LiveViewContext, type LiveViewEvent, type LiveViewState, type SessionFailure, initialContext, transition } from './live-view-machine';

const ctx = (state: LiveViewState, patch: Partial<LiveViewContext> = {}): LiveViewContext => ({
	state,
	attempt: 0,
	retryInMs: null,
	reconnect: false,
	...patch,
});

const run = (start: LiveViewContext, events: LiveViewEvent[]): LiveViewContext =>
	events.reduce((context, event) => transition(context, event), start);

const closed = (code: number, reason: string): LiveViewEvent => ({ type: 'socket_closed', code, reason });

const failed = (failure: SessionFailure): LiveViewEvent => ({ type: 'session_failed', failure });

const toPlaying = (start: LiveViewContext): LiveViewContext =>
	run(start, [{ type: 'start' }, { type: 'session_created' }, { type: 'media_started' }]);

const IDLE: LiveViewContext[] = [
	ctx('snapshot'),
	ctx('codec_unsupported'),
	ctx('relay_unavailable'),
	ctx('camera_limit'),
	ctx('total_limit'),
	ctx('module_disabled'),
	ctx('error', { attempt: 6, retryInMs: null }),
];

const ALL: LiveViewContext[] = [
	...IDLE,
	ctx('requesting'),
	ctx('connecting'),
	ctx('playing'),
	ctx('error', { attempt: 2, retryInMs: 4000 }),
	ctx('offline'),
];

describe('live view machine', () => {
	it('starts in snapshot with no attempts', () => {
		expect(initialContext()).toEqual(ctx('snapshot'));
	});

	describe.each(IDLE)('idle state $state (retryInMs $retryInMs)', (idle) => {
		it.each(['start', 'retry'] as const)('%s → requesting with attempt 0', (type) => {
			expect(transition(idle, { type })).toEqual(ctx('requesting'));
		});
	});

	it.each(ALL.filter((c) => c.state !== 'offline'))('stop from $state → snapshot', (from) => {
		expect(transition(from, { type: 'stop' })).toEqual(ctx('snapshot'));
	});

	it.each(ALL)('device_offline from $state → offline', (from) => {
		expect(transition(from, { type: 'device_offline' })).toEqual(ctx('offline'));
	});

	it('offline leaves only through device_online', () => {
		const offline = ctx('offline');
		const others: LiveViewEvent[] = [
			{ type: 'start' },
			{ type: 'stop' },
			{ type: 'retry' },
			{ type: 'session_created' },
			failed('failed'),
			{ type: 'media_started' },
			{ type: 'playing_stable' },
			closed(1006, ''),
			{ type: 'codec_unsupported' },
			{ type: 'retry_due' },
		];

		for (const event of others) {
			expect(transition(offline, event)).toBe(offline);
		}

		expect(transition(offline, { type: 'device_online' })).toEqual(ctx('snapshot'));
	});

	it('device_offline overrides playing and stop keeps offline', () => {
		const offline = transition(toPlaying(initialContext()), { type: 'device_offline' });

		expect(offline.state).toBe('offline');
		expect(transition(offline, { type: 'stop' })).toBe(offline);
	});

	it('ignores events that have no rule for the current state', () => {
		const snapshot = initialContext();

		expect(transition(snapshot, { type: 'session_created' })).toBe(snapshot);
		expect(transition(snapshot, { type: 'device_online' })).toBe(snapshot);
		expect(transition(snapshot, { type: 'playing_stable' })).toBe(snapshot);

		const requesting = ctx('requesting');

		expect(transition(requesting, { type: 'start' })).toBe(requesting);
		expect(transition(requesting, { type: 'media_started' })).toBe(requesting);
		expect(transition(requesting, closed(1006, ''))).toBe(requesting);

		const pending = ctx('error', { attempt: 1, retryInMs: 2000 });

		expect(transition(pending, { type: 'start' })).toBe(pending);
	});

	it('ignores media_started after stop', () => {
		const stopped = run(initialContext(), [{ type: 'start' }, { type: 'session_created' }, { type: 'stop' }]);

		expect(transition(stopped, { type: 'media_started' })).toBe(stopped);
		expect(transition(stopped, closed(1006, ''))).toBe(stopped);
		expect(transition(stopped, { type: 'retry_due' })).toBe(stopped);
	});

	it('walks requesting → connecting → playing', () => {
		const requesting = transition(initialContext(), { type: 'start' });
		const connecting = transition(requesting, { type: 'session_created' });
		const playing = transition(connecting, { type: 'media_started' });

		expect(requesting.state).toBe('requesting');
		expect(connecting.state).toBe('connecting');
		expect(playing).toEqual(ctx('playing'));
	});

	it.each<[SessionFailure, LiveViewContext]>([
		['relay_unavailable', ctx('relay_unavailable')],
		['module_disabled', ctx('module_disabled')],
		['camera_unavailable', ctx('error', { attempt: 1, retryInMs: 2000 })],
		['failed', ctx('error', { attempt: 1, retryInMs: 2000 })],
		['not_found', ctx('error')],
		['forbidden', ctx('error')],
	])('session_failed %s', (failure, expected) => {
		expect(transition(ctx('requesting'), failed(failure))).toEqual(expected);
	});

	it.each<[number, string, LiveViewContext]>([
		[1013, 'relay_unavailable', ctx('relay_unavailable')],
		[1013, 'session_limit', ctx('total_limit')],
		[1013, 'camera_session_limit', ctx('camera_limit')],
		[1013, 'slow_consumer', ctx('error', { attempt: 1, retryInMs: 2000 })],
		[4000, 'revoked', ctx('error')],
		[1003, 'unsupported_data', ctx('error')],
		[1008, 'protocol_violation', ctx('error')],
		[4001, 'module_disabled', ctx('module_disabled')],
		[1001, 'server_shutdown', ctx('error', { attempt: 1, retryInMs: 2000 })],
		[1006, '', ctx('error', { attempt: 1, retryInMs: 2000 })],
		[1011, 'upstream_failed', ctx('error', { attempt: 1, retryInMs: 2000 })],
		[1011, 'upstream_closed', ctx('error', { attempt: 1, retryInMs: 2000 })],
	])('socket_closed %i %s', (code, reason, expected) => {
		expect(transition(ctx('connecting'), closed(code, reason))).toEqual(expected);
		expect(transition(ctx('playing'), closed(code, reason))).toEqual(expected);
	});

	it('max_lifetime reconnects without counting an attempt', () => {
		const playing = ctx('playing', { attempt: 2 });
		const next = transition(playing, closed(4002, 'max_lifetime'));

		expect(next).toEqual(ctx('requesting', { attempt: 2, reconnect: true }));

		const connecting = transition(next, { type: 'session_created' });

		expect(connecting).toEqual(ctx('connecting', { attempt: 2, reconnect: true }));
		expect(transition(connecting, { type: 'media_started' })).toEqual(ctx('playing', { attempt: 2 }));
	});

	it('max_lifetime while connecting counts as a failure', () => {
		expect(transition(ctx('connecting', { reconnect: true }), closed(4002, 'max_lifetime'))).toEqual(ctx('error', { attempt: 1, retryInMs: 2000 }));
	});

	it('retries five times with 2, 4, 8, 16, 30 s then stops', () => {
		let context = transition(initialContext(), { type: 'start' });
		const delays: (number | null)[] = [];

		for (let i = 0; i < 6; i++) {
			context = transition(context, failed('failed'));
			delays.push(context.retryInMs);

			expect(context.state).toBe('error');
			expect(context.attempt).toBe(i + 1);

			const next = transition(context, { type: 'retry_due' });

			if (context.retryInMs === null) {
				expect(next).toBe(context);
			} else {
				expect(next).toEqual(ctx('requesting', { attempt: i + 1 }));
				context = next;
			}
		}

		expect(delays).toEqual([...LIVE_RETRY_DELAYS_MS, null]);
		expect(transition(context, { type: 'retry' })).toEqual(ctx('requesting'));
	});

	it('retry from a pending backoff starts over with attempt 0', () => {
		expect(transition(ctx('error', { attempt: 3, retryInMs: 8000 }), { type: 'retry' })).toEqual(ctx('requesting'));
	});

	it('resets the attempt only after playing_stable', () => {
		let context = transition(initialContext(), { type: 'start' });

		// A stream that dies right after it starts keeps backing off.
		for (let i = 0; i < 3; i++) {
			context = run(context, [{ type: 'session_created' }, { type: 'media_started' }, closed(1011, 'upstream_closed'), { type: 'retry_due' }]);
		}

		expect(context).toEqual(ctx('requesting', { attempt: 3 }));

		const playing = run(context, [{ type: 'session_created' }, { type: 'media_started' }]);

		expect(playing.attempt).toBe(3);

		const stable = transition(playing, { type: 'playing_stable' });

		expect(stable).toEqual(ctx('playing'));
		expect(transition(stable, closed(1011, 'upstream_closed'))).toEqual(ctx('error', { attempt: 1, retryInMs: 2000 }));
	});

	it('retry after stop resets the attempt counter', () => {
		const failing = run(initialContext(), [{ type: 'start' }, failed('failed'), { type: 'retry_due' }, failed('failed')]);

		expect(failing.attempt).toBe(2);

		const stopped = transition(failing, { type: 'stop' });

		expect(stopped).toEqual(ctx('snapshot'));
		expect(transition(stopped, { type: 'retry' })).toEqual(ctx('requesting'));
		expect(transition(transition(stopped, { type: 'start' }), failed('failed'))).toEqual(ctx('error', { attempt: 1, retryInMs: 2000 }));
	});

	it.each(['requesting', 'connecting', 'playing'] as const)('codec_unsupported from %s → codec_unsupported', (state) => {
		expect(transition(ctx(state, { attempt: 2, reconnect: true }), { type: 'codec_unsupported' })).toEqual(ctx('codec_unsupported'));
	});
});
