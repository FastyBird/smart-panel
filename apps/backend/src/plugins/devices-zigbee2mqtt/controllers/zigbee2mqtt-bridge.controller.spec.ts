import { instanceToPlain } from 'class-transformer';

import { Zigbee2mqttService } from '../services/zigbee2mqtt.service';

import { Zigbee2mqttBridgeController } from './zigbee2mqtt-bridge.controller';

describe('Zigbee2mqttBridgeController', () => {
	const service = {
		isBridgeOnline: jest.fn(),
		getConnectionType: jest.fn(),
		getBridgeSettings: jest.fn(),
	};
	const controller = new Zigbee2mqttBridgeController(service as unknown as Zigbee2mqttService);

	beforeEach(() => jest.resetAllMocks());

	it('returns the bridge status with its freshness settings in wire format', () => {
		service.isBridgeOnline.mockReturnValue(true);
		service.getConnectionType.mockReturnValue('mqtt');
		service.getBridgeSettings.mockReturnValue({
			lastSeen: 'ISO_8601',
			cacheState: true,
			cacheStateSendOnStartup: true,
			retain: false,
			receivedAt: '2026-11-18T12:00:00.000Z',
		});
		expect(instanceToPlain(controller.getStatus().data)).toEqual({
			online: true,
			connection_type: 'mqtt',
			settings: {
				last_seen: 'ISO_8601',
				cache_state: true,
				cache_state_send_on_startup: true,
				retain: false,
				received_at: '2026-11-18T12:00:00.000Z',
			},
		});
	});

	it('reports null settings before the bridge has sent them', () => {
		service.isBridgeOnline.mockReturnValue(false);
		service.getConnectionType.mockReturnValue('ws');
		service.getBridgeSettings.mockReturnValue(null);
		expect(instanceToPlain(controller.getStatus().data)).toEqual({
			online: false,
			connection_type: 'ws',
			settings: null,
		});
	});
});
