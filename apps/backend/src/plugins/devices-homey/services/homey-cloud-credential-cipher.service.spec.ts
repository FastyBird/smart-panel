import { HOMEY_CLOUD_CALLBACK_PATH } from '../devices-homey.constants';
import { HomeyCloudGrantStateError } from '../errors/homey-cloud-grant.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import {
	HomeyCloudCredentialCipherService,
	HomeyCloudCredentialContext,
} from './homey-cloud-credential-cipher.service';

describe('HomeyCloudCredentialCipherService', () => {
	const context: HomeyCloudCredentialContext = {
		field: 'access-token',
		recordId: 'grant-one',
		recordType: 'active',
	};
	let clientSecret: string;
	let service: HomeyCloudCredentialCipherService;

	beforeEach(() => {
		clientSecret = 'deployment-owned-client-secret';
		service = new HomeyCloudCredentialCipherService({
			getConfiguration: jest.fn(() => ({
				clientId: 'client-id',
				clientSecret,
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			})),
		} as unknown as HomeyCloudClientConfigService);
	});

	it('encrypts the same token with unique authenticated envelopes', () => {
		const first = service.encrypt('provider-access-token', context);
		const second = service.encrypt('provider-access-token', context);

		expect(first).not.toBe('provider-access-token');
		expect(second).not.toBe(first);
		expect(service.isEncrypted(first)).toBe(true);
		expect(service.decrypt(first, context)).toBe('provider-access-token');
		expect(service.decrypt(second, context)).toBe('provider-access-token');
	});

	it('binds ciphertext to its record, field, and deployment client secret', () => {
		const encrypted = service.encrypt('provider-access-token', context);

		expect(() => service.decrypt(encrypted, { ...context, recordId: 'grant-two' })).toThrow(HomeyCloudGrantStateError);
		expect(() => service.decrypt(encrypted, { ...context, field: 'refresh-token' })).toThrow(HomeyCloudGrantStateError);

		clientSecret = 'rotated-client-secret';
		expect(() => service.decrypt(encrypted, context)).toThrow(HomeyCloudGrantStateError);
	});

	it('fails closed for a malformed or tampered encrypted envelope', () => {
		const encrypted = service.encrypt('provider-access-token', context);
		const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

		expect(() => service.decrypt('fbsp-homey-oauth-v1.invalid', context)).toThrow(HomeyCloudGrantStateError);
		expect(() => service.decrypt(tampered, context)).toThrow(HomeyCloudGrantStateError);
	});

	it('rejects legacy plaintext unless the persistence boundary explicitly upgrades it', () => {
		expect(service.isEncrypted('legacy-access-token')).toBe(false);
		expect(() => service.decrypt('legacy-access-token', context)).toThrow(HomeyCloudGrantStateError);
	});
});
