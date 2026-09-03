import { validate } from 'class-validator';

import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { RemoteAccessConfigModel } from './config.model';

describe('RemoteAccessConfigModel', () => {
	it('uses the documented defaults', async () => {
		const config = new RemoteAccessConfigModel();

		expect(config).toMatchObject({
			type: REMOTE_ACCESS_MODULE_NAME,
			enabled: true,
			internalUrl: null,
			externalUrl: null,
			trustForwardedHeaders: false,
			trustedProxies: [],
		});
		expect(await validate(config)).toHaveLength(0);
	});

	it('accepts a normalized internal and external URL', async () => {
		const config = new RemoteAccessConfigModel();
		config.internalUrl = 'https://panel.local';
		config.externalUrl = 'http://panel.example.com';

		expect(await validate(config)).toHaveLength(0);
	});

	it('rejects a URL carrying a path', async () => {
		const config = new RemoteAccessConfigModel();
		config.externalUrl = 'https://panel.example.com/reverse-proxy';

		const errors = await validate(config);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'externalUrl')).toBe(true);
	});

	it('rejects a URL carrying credentials', async () => {
		const config = new RemoteAccessConfigModel();
		config.internalUrl = 'https://admin:secret@panel.local';

		const errors = await validate(config);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'internalUrl')).toBe(true);
	});

	it('accepts a mixed list of IPv4/IPv6 addresses and CIDR ranges', async () => {
		const config = new RemoteAccessConfigModel();
		config.trustedProxies = ['127.0.0.1', '10.0.0.0/8', '::1', 'fc00::/7'];

		expect(await validate(config)).toHaveLength(0);
	});

	it('rejects a malformed trusted proxy entry', async () => {
		const config = new RemoteAccessConfigModel();
		config.trustedProxies = ['10.0.0.0/8', 'not-an-address'];

		const errors = await validate(config);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'trustedProxies')).toBe(true);
	});

	it('rejects duplicate trusted proxy entries', async () => {
		const config = new RemoteAccessConfigModel();
		config.trustedProxies = ['10.0.0.0/8', '10.0.0.0/8'];

		const errors = await validate(config);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'trustedProxies')).toBe(true);
	});
});
