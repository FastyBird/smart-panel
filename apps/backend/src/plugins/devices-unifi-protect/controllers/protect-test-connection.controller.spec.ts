import { instanceToPlain } from 'class-transformer';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ProtectTestConnectionMode, ProtectTestSavedConnectionDto } from '../dto/test-connection.dto';
import { ProtectCertificateModel, ProtectTestConnectionModel } from '../models/test-connection.model';
import { ProtectConnectionTestService } from '../services/protect-connection-test.service';

import { ProtectTestConnectionController } from './protect-test-connection.controller';

describe('ProtectTestConnectionController', () => {
	it('wraps the credential-safe result in the standard envelope with snake_case fields', async () => {
		const request = Object.assign(new ProtectTestSavedConnectionDto(), { mode: ProtectTestConnectionMode.SAVED });
		const certificate = Object.assign(new ProtectCertificateModel(), {
			fingerprintSha256: 'ab'.repeat(32),
			subjectCommonName: 'console',
			issuerCommonName: 'console',
			subjectAltNames: ['x.id.ui.direct'],
			validFrom: '2020-01-01T00:00:00.000Z',
			validTo: '2099-01-01T00:00:00.000Z',
			selfSigned: true,
			trusted: false,
		});
		const result = Object.assign(new ProtectTestConnectionModel(), {
			mode: ProtectTestConnectionMode.SAVED,
			success: false,
			tlsMode: 'verify',
			certificate,
			directConnectDomain: 'x.id.ui.direct',
			suggestedServerName: 'x.id.ui.direct',
			consoleName: 'Dream Machine',
			consoleModel: 'UDMPRO',
			applicationVersion: null,
			minimumVersion: '7.2.105',
			versionSupported: null,
			nvrName: null,
			errorCategory: 'tls_untrusted',
			error: 'The certificate presented by the UniFi Protect console is not trusted',
		});
		const service = { testConnection: jest.fn().mockResolvedValue(result) };
		const controller = new ProtectTestConnectionController(service as unknown as ProtectConnectionTestService);

		const response = await controller.testConnection({ data: request });

		expect(service.testConnection).toHaveBeenCalledWith(request);
		expect(response.data).toBe(result);

		const serialized = instanceToPlain(response);

		expect(serialized.data).toMatchObject({
			mode: 'saved',
			success: false,
			tls_mode: 'verify',
			direct_connect_domain: 'x.id.ui.direct',
			suggested_server_name: 'x.id.ui.direct',
			console_name: 'Dream Machine',
			console_model: 'UDMPRO',
			minimum_version: '7.2.105',
			error_category: 'tls_untrusted',
			certificate: { fingerprint_sha256: 'ab'.repeat(32), self_signed: true, trusted: false },
		});
		expect(JSON.stringify(serialized)).not.toContain('api_key');
	});

	it('allows only owners and administrators to test credentials', () => {
		// Metadata inspection intentionally references the unbound controller method.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const handler = ProtectTestConnectionController.prototype.testConnection;

		expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
	});

	it('answers on POST test-connection with status 200', () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const handler = ProtectTestConnectionController.prototype.testConnection;

		expect(Reflect.getMetadata('path', handler)).toBe('test-connection');
		expect(Reflect.getMetadata('__httpCode__', handler)).toBe(200);
	});
});
