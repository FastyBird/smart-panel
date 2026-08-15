import { instanceToPlain } from 'class-transformer';

import { HomeyConnectionState } from '../devices-homey.constants';
import { HomeyStatusModel } from '../models/status.model';
import { HomeyService } from '../services/homey.service';

import { HomeyStatusController } from './homey-status.controller';

describe('HomeyStatusController', () => {
	it('wraps the secret-free provider status in the standard response envelope', () => {
		const status = Object.assign(new HomeyStatusModel(), {
			serviceState: 'started',
			connectionState: HomeyConnectionState.STOPPED,
			enabled: true,
			configured: true,
			healthy: false,
			degraded: false,
			homeyId: 'homey-system',
			homeyName: 'Homey Pro',
			homeyVersion: '12.4.1',
			lastConnectedAt: '2026-08-15T10:00:00.000Z',
			lastInventorySyncAt: '2026-08-15T10:00:01.000Z',
			lastEventAt: '2026-08-15T10:00:02.000Z',
			reconnectCount: 1,
			lastErrorCategory: null,
			lastError: null,
		});
		const service = { getStatus: jest.fn().mockReturnValue(status) };
		const controller = new HomeyStatusController(service as unknown as HomeyService);

		const response = controller.getStatus();

		expect(response.data).toBe(status);
		expect(service.getStatus).toHaveBeenCalledTimes(1);
		const serialized = instanceToPlain(response);

		expect(serialized.data).toMatchObject({
			homey_id: 'homey-system',
			homey_name: 'Homey Pro',
			homey_version: '12.4.1',
			last_connected_at: '2026-08-15T10:00:00.000Z',
			last_inventory_sync_at: '2026-08-15T10:00:01.000Z',
			last_event_at: '2026-08-15T10:00:02.000Z',
			reconnect_count: 1,
			last_error_category: null,
		});
		expect(JSON.stringify(serialized)).not.toContain('api_key');
		expect(JSON.stringify(serialized)).not.toContain('configured-secret');
	});
});
