import { describe, expect, it } from 'vitest';

import { IntentStatus, IntentType } from '../intents.constants';

import { type IIntentRes, transformIntentResponse } from './intents.store.transformers';

const response = (origin: string | null): IIntentRes => ({
	intent_id: '6f1f4b1e-0d0b-4b6e-9d3e-3c1f6a2b7c10',
	request_id: null,
	type: IntentType.SCENE_RUN,
	context: { origin, display_id: null, space_id: null, role_key: null },
	targets: [{ device_id: null, channel_id: null, property_id: null, scene_id: '0b0f3c4e-8f43-4b55-9a3a-0c5b1e2d3f40' }],
	value: null,
	status: IntentStatus.PENDING,
	ttl_ms: 3000,
	created_at: '2026-11-11T10:00:00.000Z',
	expires_at: '2026-11-11T10:00:03.000Z',
	completed_at: null,
	results: null,
});

describe('transformIntentResponse', (): void => {
	it.each(['admin', 'api', 'panel.scenes', 'automation'])('accepts an intent of the origin %s', (origin: string): void => {
		expect(transformIntentResponse(response(origin)).context.origin).toBe(origin);
	});

	it('accepts an intent without an origin', (): void => {
		expect(transformIntentResponse(response(null)).context.origin).toBeNull();
	});

	it('refuses an origin it does not know', (): void => {
		expect(() => transformIntentResponse(response('somewhere.else'))).toThrow();
	});
});
