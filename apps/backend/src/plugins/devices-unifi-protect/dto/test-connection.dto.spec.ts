import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionRequestDto,
	ProtectTestSavedConnectionDto,
} from './test-connection.dto';

const build = (data: Record<string, unknown>): ProtectTestConnectionRequestDto =>
	plainToInstance(ProtectTestConnectionRequestDto, { data });

const candidate = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	mode: 'candidate',
	host: '192.168.1.1',
	api_key: 'new-key',
	...overrides,
});

describe('Protect test-connection DTO', () => {
	it('selects the saved DTO for mode saved and accepts it', async () => {
		const request = build({ mode: 'saved' });

		expect(request.data).toBeInstanceOf(ProtectTestSavedConnectionDto);
		expect(await validate(request)).toEqual([]);
	});

	it('selects the candidate DTO for mode candidate and accepts a minimal candidate', async () => {
		const request = build(candidate());

		expect(request.data).toBeInstanceOf(ProtectTestCandidateConnectionDto);
		expect(request.data).toMatchObject({ host: '192.168.1.1', apiKey: 'new-key' });
		expect(await validate(request)).toEqual([]);
	});

	it('requires a new key in candidate mode', async () => {
		const errors = await validate(build({ mode: 'candidate', host: '192.168.1.1' }));

		expect(errors.length).toBeGreaterThan(0);
		expect(JSON.stringify(errors)).toContain('api_key');
	});

	it.each([[''], ['   '], [null], [42]])('rejects the candidate key %j', async (key) => {
		const errors = await validate(build(candidate({ api_key: key })));

		expect(JSON.stringify(errors)).toContain('api_key');
	});

	it('normalizes the candidate fingerprint', async () => {
		const colonUpper = Array.from({ length: 32 }, () => 'AB').join(':');
		const request = build(candidate({ tls: { mode: 'pinned', fingerprint_sha256: colonUpper } }));

		expect(await validate(request)).toEqual([]);
		expect((request.data as ProtectTestCandidateConnectionDto).tls?.fingerprintSha256).toBe('ab'.repeat(32));
	});

	it.each([
		[{ host: 'https://192.168.1.1' }, 'host'],
		[{ host: undefined }, 'host'],
		[{ port: 0 }, 'port'],
		[{ port: 65536 }, 'port'],
		[{ port: 443.5 }, 'port'],
		[{ tls: { mode: 'insecure' } }, 'mode'],
		[{ tls: { server_name: 'x.id.ui.direct' } }, 'mode'],
		[{ tls: { mode: 'verify', server_name: '10.0.0.1' } }, 'server_name'],
		[{ tls: { mode: 'pinned', fingerprint_sha256: 'abc' } }, 'fingerprint_sha256'],
		[{ tls: 'verify' }, 'tls'],
	])('rejects the candidate field %j', async (overrides, field) => {
		const errors = await validate(build(candidate(overrides)));

		expect(errors.length).toBeGreaterThan(0);
		expect(JSON.stringify(errors)).toContain(field);
	});

	it('accepts a complete verify candidate with a server name and port', async () => {
		const request = build(
			candidate({ port: 8443, tls: { mode: 'verify', server_name: 'x.id.ui.direct', fingerprint_sha256: null } }),
		);

		expect(await validate(request)).toEqual([]);
		expect((request.data as ProtectTestCandidateConnectionDto).port).toBe(8443);
	});

	it.each([[{ mode: 'other' }], [{}], [{ mode: null }]])('rejects the unknown request %j', async (data) => {
		const errors = await validate(build(data));

		expect(errors.length).toBeGreaterThan(0);
		expect(JSON.stringify(errors)).toContain('mode');
	});

	it('rejects a missing data object', async () => {
		const errors = await validate(plainToInstance(ProtectTestConnectionRequestDto, {}));

		expect(JSON.stringify(errors)).toContain('data');
	});
});
