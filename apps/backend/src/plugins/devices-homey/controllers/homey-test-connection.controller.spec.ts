import { instanceToPlain } from 'class-transformer';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { HomeyTestConnectionMode, HomeyTestSavedConnectionDto } from '../dto/test-connection.dto';
import { HomeyTestConnectionModel } from '../models/test-connection.model';
import { HomeyConnectionTestService } from '../services/homey-connection-test.service';

import { HomeyTestConnectionController } from './homey-test-connection.controller';

describe('HomeyTestConnectionController', () => {
	it('wraps the credential-safe connection result in the standard response envelope', async () => {
		const request = Object.assign(new HomeyTestSavedConnectionDto(), { mode: HomeyTestConnectionMode.SAVED });
		const result = Object.assign(new HomeyTestConnectionModel(), {
			mode: HomeyTestConnectionMode.SAVED,
			success: true,
			homeyId: 'homey-system',
			homeyName: 'Homey Pro',
			homeyVersion: '13.4.0',
			errorCategory: null,
			error: null,
		});
		const service = { testConnection: jest.fn().mockResolvedValue(result) };
		const controller = new HomeyTestConnectionController(service as unknown as HomeyConnectionTestService);

		const response = await controller.testConnection({ data: request });

		expect(service.testConnection).toHaveBeenCalledWith(request);
		expect(response.data).toBe(result);
		const serialized = instanceToPlain(response);
		expect(serialized.data).toMatchObject({
			mode: HomeyTestConnectionMode.SAVED,
			success: true,
			homey_id: 'homey-system',
			homey_name: 'Homey Pro',
			homey_version: '13.4.0',
			error_category: null,
		});
		expect(JSON.stringify(serialized)).not.toContain('api_key');
	});

	it('allows only owners and administrators to test credentials', () => {
		// Metadata inspection intentionally references the unbound controller method.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const handler = HomeyTestConnectionController.prototype.testConnection;

		expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
	});
});
