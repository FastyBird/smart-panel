import { describe, expect, it, vi } from 'vitest';

import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
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
	mode: DevicesHomeyPluginConnectionMode.local,
	url: 'http://homey.local:4859',
	apiKey: 'new-api-key',
	apiKeyConfigured: false,
	cloudClientId: 'client-id',
	cloudClientSecret: 'client-secret',
	cloudClientSecretConfigured: false,
	cloudRedirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
	connectionTimeout: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	reconciliationInterval: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
	...overrides,
});

describe('HomeyConfigEditFormSchema', () => {
	it.each([
		['a non-empty replacement', { apiKey: 'new-api-key', apiKeyConfigured: false }],
		['an existing stored key', { apiKey: undefined, apiKeyConfigured: true }],
	])('accepts %s while enabled', (_label, overrides) => {
		expect(HomeyConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it.each([
		['a missing key', { apiKey: undefined, apiKeyConfigured: false }],
		['a removed key', { apiKey: null, apiKeyConfigured: true }],
	])('accepts %s while enabled so runtime readiness can defer startup', (_label, overrides) => {
		expect(HomeyConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it('rejects a whitespace key replacement while enabled', () => {
		const result = HomeyConfigEditFormSchema.safeParse(createConfig({ apiKey: '   ', apiKeyConfigured: true }));

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['apiKey'] })]));
	});

	it('accepts incomplete cloud mode while enabled so runtime readiness can defer startup', () => {
		const result = HomeyConfigEditFormSchema.safeParse(
			createConfig({
				mode: DevicesHomeyPluginConnectionMode.cloud,
				cloudClientId: null,
				cloudClientSecret: undefined,
				cloudClientSecretConfigured: false,
				cloudRedirectUrl: null,
			})
		);

		expect(result.success).toBe(true);
	});

	it('rejects an unsafe Homey Cloud registered callback', () => {
		const result = HomeyConfigEditFormSchema.safeParse(
			createConfig({
				mode: DevicesHomeyPluginConnectionMode.cloud,
				cloudRedirectUrl: 'http://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			})
		);

		expect(result.success).toBe(false);
	});

	it('allows the key to be absent or removed while disabled', () => {
		expect(HomeyConfigEditFormSchema.safeParse(createConfig({ enabled: false, apiKey: null, apiKeyConfigured: true })).success).toBe(true);
	});

	it('rejects a whitespace-only key replacement while disabled', () => {
		const result = HomeyConfigEditFormSchema.safeParse(createConfig({ enabled: false, apiKey: '   ', apiKeyConfigured: true }));

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['apiKey'] })]));
	});

	it('accepts complete cloud mode without local credentials', () => {
		expect(
			HomeyConfigEditFormSchema.safeParse(
				createConfig({
					mode: DevicesHomeyPluginConnectionMode.cloud,
					url: null,
					apiKey: null,
					apiKeyConfigured: false,
				})
			).success
		).toBe(true);
	});

	it('accepts a stored write-only Homey Cloud client secret', () => {
		expect(
			HomeyConfigEditFormSchema.safeParse(
				createConfig({
					mode: DevicesHomeyPluginConnectionMode.cloud,
					cloudClientSecret: undefined,
					cloudClientSecretConfigured: true,
				})
			).success
		).toBe(true);
	});

	it('omits a hidden local key replacement from cloud-mode submissions', () => {
		const result = HomeyConfigEditFormSchema.safeParse(createConfig({ mode: DevicesHomeyPluginConnectionMode.cloud, apiKey: '   ' }));

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.apiKey).toBeUndefined();
	});

	it('omits a hidden invalid local URL from cloud-mode submissions', () => {
		const result = HomeyConfigEditFormSchema.safeParse(
			createConfig({ mode: DevicesHomeyPluginConnectionMode.cloud, url: 'file:///hidden-local-path' })
		);

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.url).toBeUndefined();
	});

	it('omits hidden cloud credentials from local-mode submissions', () => {
		const result = HomeyConfigEditFormSchema.safeParse(
			createConfig({ cloudClientId: 'hidden-client', cloudClientSecret: 'hidden-secret', cloudRedirectUrl: 'invalid' })
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.cloudClientId).toBeUndefined();
			expect(result.data.cloudClientSecret).toBeUndefined();
			expect(result.data.cloudRedirectUrl).toBeUndefined();
		}
	});

	it('rejects an invalid URL in local mode', () => {
		const result = HomeyConfigEditFormSchema.safeParse(createConfig({ url: 'file:///local-path' }));

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['url'] })]));
	});

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
