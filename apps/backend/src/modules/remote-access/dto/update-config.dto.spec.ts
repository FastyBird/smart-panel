import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { UpdateRemoteAccessConfigDto } from './update-config.dto';

describe('UpdateRemoteAccessConfigDto', () => {
	it('accepts a partial update with no optional fields set', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, { type: REMOTE_ACCESS_MODULE_NAME });

		expect(await validate(dto)).toHaveLength(0);
	});

	it('leaves enabled unset when a partial update omits it, so a stored enabled: false survives the merge', () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			trust_forwarded_headers: true,
		});

		expect(dto.enabled).toBeUndefined();

		// Mirrors ConfigSecretsService's own toPlainConfig(), which is what
		// ConfigService.setModuleConfig() merges against the stored config:
		// exposeUnsetFields: false must drop the unset `enabled` key entirely
		// rather than serializing it as `true`, or mergePlain() would clobber
		// a previously persisted enabled: false.
		const plain = instanceToPlain(dto, { exposeUnsetFields: false });

		expect(plain).not.toHaveProperty('enabled');
	});

	it('accepts a normalized internal_url and external_url, and permits clearing them with null', async () => {
		for (const value of ['https://panel.example.com', 'http://panel.example.com', null]) {
			const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
				type: REMOTE_ACCESS_MODULE_NAME,
				internal_url: value,
				external_url: value,
			});

			expect(await validate(dto)).toHaveLength(0);
		}
	});

	it('normalizes a trailing-slash/upper-case/redundant-port URL to its canonical origin before validation and persistence, not just at validation time', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			internal_url: 'https://panel.example.com/',
			external_url: 'HTTPS://Example.COM:443',
		});

		expect(await validate(dto)).toHaveLength(0);
		// The point of the fix: the field itself carries the canonical origin, not the raw
		// input the caller sent - IsRemoteAccessUrlConstraint only checks, it never rewrites.
		expect(dto.internal_url).toBe('https://panel.example.com');
		expect(dto.external_url).toBe('https://example.com');
	});

	it('leaves an unnormalizable value untouched so the validator error still reflects what the caller sent', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			internal_url: 'https://panel.example.com/reverse-proxy',
		});

		expect(dto.internal_url).toBe('https://panel.example.com/reverse-proxy');

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'internal_url')).toBe(true);
	});

	it('rejects a URL carrying a path', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			external_url: 'https://panel.example.com/reverse-proxy',
		});

		const errors = await validate(dto);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'external_url')).toBe(true);
	});

	it('rejects a URL carrying credentials', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			internal_url: 'https://admin:secret@panel.local',
		});

		const errors = await validate(dto);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'internal_url')).toBe(true);
	});

	it('accepts a mixed list of IPv4/IPv6 addresses and CIDR ranges', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			trusted_proxies: ['127.0.0.1', '10.0.0.0/8', '::1', 'fc00::/7'],
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects a malformed trusted proxy entry', async () => {
		const dto = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			trusted_proxies: ['10.0.0.0/8', '10.0.0.0/'],
		});

		const errors = await validate(dto);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'trusted_proxies')).toBe(true);
	});

	it('accepts only a boolean trust_forwarded_headers', async () => {
		const valid = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			trust_forwarded_headers: true,
		});
		const invalid = plainToInstance(UpdateRemoteAccessConfigDto, {
			type: REMOTE_ACCESS_MODULE_NAME,
			trust_forwarded_headers: 'true',
		});

		expect(await validate(valid)).toHaveLength(0);
		expect(await validate(invalid)).not.toHaveLength(0);
	});
});
