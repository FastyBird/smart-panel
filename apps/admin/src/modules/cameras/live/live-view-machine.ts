import { LIVE_RETRY_DELAYS_MS } from '../cameras.constants';

/**
 * States of one camera live view. `requesting` (creating a session) is drawn like `connecting`; `module_disabled`
 * means the cameras module was switched off.
 */
export type LiveViewState =
	| 'snapshot'
	| 'requesting'
	| 'connecting'
	| 'playing'
	| 'codec_unsupported'
	| 'offline'
	| 'relay_unavailable'
	| 'camera_limit'
	| 'total_limit'
	| 'module_disabled'
	| 'error';

export type SessionFailure = 'relay_unavailable' | 'camera_unavailable' | 'module_disabled' | 'not_found' | 'forbidden' | 'failed';

export type LiveViewEvent =
	| { type: 'start' }
	| { type: 'stop' }
	| { type: 'retry' }
	| { type: 'session_created' }
	| { type: 'session_failed'; failure: SessionFailure }
	| { type: 'media_started' }
	| { type: 'playing_stable' }
	| { type: 'socket_closed'; code: number; reason: string }
	| { type: 'codec_unsupported' }
	| { type: 'device_offline' }
	| { type: 'device_online' }
	| { type: 'retry_due' };

export interface LiveViewContext {
	state: LiveViewState;
	/** Failed attempts since the last stable playback or a manual start. */
	attempt: number;
	/** Delay before the next automatic attempt; `null` when none is scheduled. */
	retryInMs: number | null;
	/** A seamless reconnect (after `max_lifetime`): the UI keeps the last frame and shows no connecting overlay. */
	reconnect: boolean;
}

const at = (state: LiveViewState, attempt = 0): LiveViewContext => ({ state, attempt, retryInMs: null, reconnect: false });

export const initialContext = (): LiveViewContext => at('snapshot');

const isIdle = (context: LiveViewContext): boolean => {
	switch (context.state) {
		case 'snapshot':
		case 'codec_unsupported':
		case 'relay_unavailable':
		case 'camera_limit':
		case 'total_limit':
		case 'module_disabled':
			return true;
		case 'error':
			return context.retryInMs === null;
		default:
			return false;
	}
};

const retryableError = (context: LiveViewContext): LiveViewContext => {
	const attempt = context.attempt + 1;

	return { ...at('error', attempt), retryInMs: attempt <= LIVE_RETRY_DELAYS_MS.length ? LIVE_RETRY_DELAYS_MS[attempt - 1] : null };
};

const onSessionFailed = (context: LiveViewContext, failure: SessionFailure): LiveViewContext => {
	switch (failure) {
		case 'relay_unavailable':
			return at('relay_unavailable');
		case 'module_disabled':
			return at('module_disabled');
		case 'not_found':
		case 'forbidden':
			return at('error');
		case 'camera_unavailable':
		case 'failed':
			return retryableError(context);
	}
};

const onSocketClosed = (context: LiveViewContext, code: number, reason: string): LiveViewContext => {
	if (code === 1013) {
		switch (reason) {
			case 'relay_unavailable':
				return at('relay_unavailable');
			case 'session_limit':
				return at('total_limit');
			case 'camera_session_limit':
				return at('camera_limit');
			default:
				return retryableError(context);
		}
	}

	switch (code) {
		case 4002:
			// A reconnect that never reached media counts as a failure, so it cannot loop.
			return context.state === 'playing' ? { ...at('requesting', context.attempt), reconnect: true } : retryableError(context);
		case 4000:
		case 1003:
		case 1008:
			return at('error');
		case 4001:
			return at('module_disabled');
		default:
			return retryableError(context);
	}
};

/**
 * Pure transition of the live view. An event without a rule for the current state returns the same context, so late
 * events (a `media_started`, `socket_closed` or `retry_due` after `stop`) change nothing. Timers belong to the caller.
 */
export const transition = (context: LiveViewContext, event: LiveViewEvent): LiveViewContext => {
	const { state } = context;

	if (event.type === 'device_offline') {
		return state === 'offline' ? context : at('offline');
	}

	if (state === 'offline') {
		return event.type === 'device_online' ? initialContext() : context;
	}

	switch (event.type) {
		case 'stop':
			return state === 'snapshot' ? context : initialContext();
		case 'start':
			return isIdle(context) ? at('requesting') : context;
		case 'retry':
			return isIdle(context) || state === 'error' ? at('requesting') : context;
		case 'retry_due':
			return state === 'error' && context.retryInMs !== null ? at('requesting', context.attempt) : context;
		case 'session_created':
			return state === 'requesting' ? { ...context, state: 'connecting' } : context;
		case 'session_failed':
			return state === 'requesting' ? onSessionFailed(context, event.failure) : context;
		case 'media_started':
			return state === 'connecting' ? at('playing', context.attempt) : context;
		case 'playing_stable':
			return state === 'playing' && context.attempt !== 0 ? at('playing') : context;
		case 'socket_closed':
			return state === 'connecting' || state === 'playing' ? onSocketClosed(context, event.code, event.reason) : context;
		case 'codec_unsupported':
			return state === 'requesting' || state === 'connecting' || state === 'playing' ? at('codec_unsupported') : context;
		case 'device_online':
			return context;
	}
};
