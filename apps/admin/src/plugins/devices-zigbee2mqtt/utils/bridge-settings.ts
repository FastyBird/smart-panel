import type { DevicesZigbee2mqttPluginBridgeStatusSchema } from '../../../openapi.constants';

export interface IZ2mBridgeSettings {
	/** Zigbee2MQTT `advanced.last_seen`; anything but `disable` times values by the device report */
	lastSeen: string | null;
	cacheState: boolean | null;
	cacheStateSendOnStartup: boolean | null;
	retain: boolean;
	receivedAt: string;
}

export interface IZ2mBridgeStatus {
	online: boolean;
	connectionType: 'mqtt' | 'ws';
	settings: IZ2mBridgeSettings | null;
}

export type Z2mBridgeHintId = 'lastSeen' | 'retain';

export interface IZ2mBridgeHint {
	id: Z2mBridgeHintId;
	severity: 'warning' | 'info';
}

export const transformBridgeStatusResponse = (data: DevicesZigbee2mqttPluginBridgeStatusSchema): IZ2mBridgeStatus => ({
	online: data.online,
	connectionType: data.connection_type === 'ws' ? 'ws' : 'mqtt',
	settings: data.settings
		? {
				lastSeen: data.settings.last_seen ?? null,
				cacheState: data.settings.cache_state ?? null,
				cacheStateSendOnStartup: data.settings.cache_state_send_on_startup ?? null,
				retain: data.settings.retain,
				receivedAt: data.settings.received_at,
			}
		: null,
});

/**
 * The bridge settings worth changing so values stay usable by virtual devices and automations.
 * Nothing is recommended until the bridge is online and has reported its settings.
 */
export const bridgeSettingsHints = (status: IZ2mBridgeStatus | null): IZ2mBridgeHint[] => {
	if (status === null || !status.online || status.settings === null) {
		return [];
	}

	const hints: IZ2mBridgeHint[] = [];

	// Without last_seen, values replayed at startup have no age, so sleeping devices stay non-fresh.
	if (status.settings.lastSeen === null || status.settings.lastSeen === 'disable') {
		hints.push({ id: 'lastSeen', severity: 'warning' });
	}

	// Retained states only matter on MQTT: the WebSocket connection gets a snapshot on connect anyway.
	if (status.connectionType === 'mqtt' && !status.settings.retain) {
		hints.push({ id: 'retain', severity: 'info' });
	}

	return hints;
};
