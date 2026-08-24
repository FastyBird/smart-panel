import { describe, expect, it, vi } from 'vitest';

import {
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

import { HomeyConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'devices-homey',
	enabled: true,
	url: 'http://homey.local:4859',
	apiKey: null,
	connectionTimeout: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	reconciliationInterval: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
	...overrides,
});

describe('HomeyConfigEditFormSchema', () => {
	it.each([
		['connection timeout minimum', { connectionTimeout: MIN_HOMEY_CONNECTION_TIMEOUT_MS }],
		['connection timeout maximum', { connectionTimeout: MAX_HOMEY_CONNECTION_TIMEOUT_MS }],
		['reconciliation interval minimum', { reconciliationInterval: MIN_HOMEY_RECONCILIATION_INTERVAL_MS }],
		['reconciliation interval maximum', { reconciliationInterval: MAX_HOMEY_RECONCILIATION_INTERVAL_MS }],
	])('accepts the backend %s', (_label, overrides) => {
		expect(HomeyConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it.each([
		['connection timeout below minimum', { connectionTimeout: MIN_HOMEY_CONNECTION_TIMEOUT_MS - 1 }],
		['connection timeout above maximum', { connectionTimeout: MAX_HOMEY_CONNECTION_TIMEOUT_MS + 1 }],
		['reconciliation interval below minimum', { reconciliationInterval: MIN_HOMEY_RECONCILIATION_INTERVAL_MS - 1 }],
		['reconciliation interval above maximum', { reconciliationInterval: MAX_HOMEY_RECONCILIATION_INTERVAL_MS + 1 }],
	])('rejects a %s', (_label, overrides) => {
		expect(HomeyConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(false);
	});
});
