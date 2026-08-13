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
			lastError: null,
		});
		const service = { getStatus: jest.fn().mockReturnValue(status) };
		const controller = new HomeyStatusController(service as unknown as HomeyService);

		const response = controller.getStatus();

		expect(response.data).toBe(status);
		expect(service.getStatus).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(response)).not.toContain('api_key');
		expect(JSON.stringify(response)).not.toContain('configured-secret');
	});
});
