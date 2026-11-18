import { describe, expect, it } from 'vitest';

import { type IZ2mBridgeStatus, bridgeSettingsHints, transformBridgeStatusResponse } from './bridge-settings';

const status = (overrides: Partial<IZ2mBridgeStatus> = {}, settings: Partial<NonNullable<IZ2mBridgeStatus['settings']>> = {}): IZ2mBridgeStatus => ({
	online: true,
	connectionType: 'mqtt',
	settings: {
		lastSeen: 'ISO_8601',
		cacheState: true,
		cacheStateSendOnStartup: true,
		retain: true,
		receivedAt: '2026-11-18T12:00:00.000Z',
		...settings,
	},
	...overrides,
});

describe('bridgeSettingsHints', () => {
	it('recommends nothing for a bridge already set up for fresh values', () => {
		expect(bridgeSettingsHints(status())).toEqual([]);
	});

	it('warns when last_seen is disabled or not reported', () => {
		expect(bridgeSettingsHints(status({}, { lastSeen: 'disable' }))).toEqual([{ id: 'lastSeen', severity: 'warning' }]);
		expect(bridgeSettingsHints(status({}, { lastSeen: null }))).toEqual([{ id: 'lastSeen', severity: 'warning' }]);
	});

	it('suggests retain only for the MQTT connection', () => {
		expect(bridgeSettingsHints(status({}, { retain: false }))).toEqual([{ id: 'retain', severity: 'info' }]);
		expect(bridgeSettingsHints(status({ connectionType: 'ws' }, { retain: false }))).toEqual([]);
	});

	it('recommends nothing while the bridge is offline or has not reported its settings', () => {
		expect(bridgeSettingsHints(null)).toEqual([]);
		expect(bridgeSettingsHints(status({ online: false }, { lastSeen: 'disable' }))).toEqual([]);
		expect(bridgeSettingsHints(status({ settings: null }))).toEqual([]);
	});
});

describe('transformBridgeStatusResponse', () => {
	it('maps the wire format and keeps missing settings as null', () => {
		expect(
			transformBridgeStatusResponse({
				online: true,
				connection_type: 'ws',
				settings: { last_seen: null, cache_state: true, retain: false, received_at: '2026-11-18T12:00:00.000Z' },
			} as Parameters<typeof transformBridgeStatusResponse>[0])
		).toEqual({
			online: true,
			connectionType: 'ws',
			settings: {
				lastSeen: null,
				cacheState: true,
				cacheStateSendOnStartup: null,
				retain: false,
				receivedAt: '2026-11-18T12:00:00.000Z',
			},
		});
		expect(
			transformBridgeStatusResponse({ online: false, connection_type: 'mqtt', settings: null } as Parameters<typeof transformBridgeStatusResponse>[0])
		).toEqual({ online: false, connectionType: 'mqtt', settings: null });
	});
});
