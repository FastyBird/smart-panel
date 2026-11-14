import { instanceToPlain } from 'class-transformer';

import { PROTECT_MIN_VERSION, ProtectConnectionState } from '../devices-unifi-protect.constants';
import { PROTECT_ERROR_MESSAGES, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectStatusModel } from '../models/status.model';
import { ProtectConnectorService } from '../services/protect-connector.service';

import { ProtectStatusController } from './protect-status.controller';

describe('ProtectStatusController', () => {
	it('wraps the connector status in the response model and serializes it as snake_case', () => {
		const status = Object.assign(new ProtectStatusModel(), {
			serviceState: 'started',
			connectionState: ProtectConnectionState.DISCONNECTED,
			enabled: true,
			configured: true,
			healthy: false,
			host: 'protect.example.com',
			tlsMode: 'pinned',
			applicationVersion: '7.3.74',
			minimumVersion: PROTECT_MIN_VERSION,
			nvrId: 'nvr-1',
			nvrName: 'Console',
			lastConnectedAt: '2026-11-14T10:00:00.000Z',
			lastErrorCategory: ProtectErrorCategory.UNREACHABLE,
			lastError: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.UNREACHABLE],
			reconnectAttempt: 2,
			nextRetryAt: '2026-11-14T10:00:05.000Z',
		});
		const connector = { getStatus: jest.fn().mockReturnValue(status) };
		const controller = new ProtectStatusController(connector as unknown as ProtectConnectorService);

		const response = controller.getStatus();

		expect(response.data).toBe(status);
		expect(connector.getStatus).toHaveBeenCalledTimes(1);
		expect(instanceToPlain(response).data).toEqual({
			service_state: 'started',
			connection_state: 'disconnected',
			enabled: true,
			configured: true,
			healthy: false,
			host: 'protect.example.com',
			tls_mode: 'pinned',
			application_version: '7.3.74',
			minimum_version: '7.2.105',
			nvr_id: 'nvr-1',
			nvr_name: 'Console',
			last_connected_at: '2026-11-14T10:00:00.000Z',
			last_error_category: 'unreachable',
			last_error: 'The UniFi Protect console cannot be reached',
			reconnect_attempt: 2,
			next_retry_at: '2026-11-14T10:00:05.000Z',
		});
	});
});
