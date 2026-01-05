import { camelCase, isArray, isObject, transform } from 'lodash';

import { IntentSchema } from './intents.store.schemas';
import type { IIntent } from './intents.store.types';

/**
 * Transform snake_case keys to camelCase recursively
 */
const toCamelCase = (obj: Record<string, unknown>): Record<string, unknown> => {
	return transform(obj, (result: Record<string, unknown>, value: unknown, key: string) => {
		const camelKey = camelCase(key);

		if (isArray(value)) {
			result[camelKey] = value.map((item) => (isObject(item) ? toCamelCase(item as Record<string, unknown>) : item));
		} else if (isObject(value) && value !== null) {
			result[camelKey] = toCamelCase(value as Record<string, unknown>);
		} else {
			result[camelKey] = value;
		}
	});
};

export interface IIntentRes {
	intent_id: string;
	request_id: string | null;
	type: string;
	scope: {
		space_id: string | null;
	} | null;
	context: {
		origin: string | null;
		display_id: string | null;
		space_id: string | null;
		role_key: string | null;
	} | null;
	targets: Array<{
		device_id: string | null;
		channel_id: string | null;
		property_id: string | null;
		scene_id: string | null;
	}>;
	value: unknown;
	status: string;
	ttl_ms: number;
	created_at: string;
	expires_at: string;
	completed_at: string | null;
	results: Array<{
		device_id: string | null;
		channel_id: string | null;
		property_id: string | null;
		scene_id: string | null;
		status: string;
		error: string | null;
	}> | null;
}

export const transformIntentResponse = (response: IIntentRes): IIntent => {
	// Transform intent_id to id for consistency
	const transformed = toCamelCase({
		...response,
		id: response.intent_id,
	}) as Record<string, unknown>;

	// Remove intentId if present (we use id)
	delete transformed.intentId;

	// Ensure scope and context have defaults
	if (!transformed.scope) {
		transformed.scope = { spaceId: null };
	}
	if (!transformed.context) {
		transformed.context = { origin: null, displayId: null, spaceId: null, roleKey: null };
	}

	const parsed = IntentSchema.safeParse(transformed);

	if (!parsed.success) {
		console.error('[INTENTS] Schema validation failed:', parsed.error);
		throw new Error('Failed to transform intent response');
	}

	return parsed.data as IIntent;
};
