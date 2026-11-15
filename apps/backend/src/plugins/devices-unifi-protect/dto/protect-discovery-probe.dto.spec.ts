import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProtectProbeDto, ProtectProbeRequestDto } from './protect-discovery-probe.dto';

const build = (data: Record<string, unknown>): ProtectProbeRequestDto =>
	plainToInstance(ProtectProbeRequestDto, { data }, { excludeExtraneousValues: false });

const check = (data: Record<string, unknown>) => validate(build(data), { whitelist: true, forbidNonWhitelisted: true });

describe('Protect probe DTO', () => {
	it('accepts { host: "192.168.1.10" } and leaves the port undefined', async () => {
		const request = build({ host: '192.168.1.10' });

		expect(request.data).toBeInstanceOf(ProtectProbeDto);
		expect(request.data.port).toBeUndefined();
		expect(await check({ host: '192.168.1.10' })).toEqual([]);
	});

	it('accepts a host with a port', async () => {
		expect(await check({ host: 'unifi.local', port: 8443 })).toEqual([]);
	});

	it('lowercases and trims the host', () => {
		expect(build({ host: ' UniFi.Local ' }).data.host).toBe('unifi.local');
	});

	describe('with implicit conversion, as the global pipe', () => {
		const buildImplicit = (data: Record<string, unknown>): ProtectProbeRequestDto =>
			plainToInstance(ProtectProbeRequestDto, { data }, { enableImplicitConversion: true });
		const checkImplicit = (data: Record<string, unknown>) =>
			validate(buildImplicit(data), { whitelist: true, forbidNonWhitelisted: true });

		it.each([true, 5])('rejects the non-string host %j', async (host) => {
			expect((await checkImplicit({ host })).length).toBeGreaterThan(0);
		});

		it('still trims and lowercases a string host', async () => {
			expect(buildImplicit({ host: ' UniFi.Local ' }).data.host).toBe('unifi.local');
			expect(await checkImplicit({ host: ' UniFi.Local ' })).toEqual([]);
		});
	});

	it.each(['http://x', '192.168.1.10:443', '169.254.169.254', '', 5])('rejects host %j', async (host) => {
		expect((await check({ host })).length).toBeGreaterThan(0);
	});

	it('rejects a missing host', async () => {
		expect((await check({})).length).toBeGreaterThan(0);
	});

	it.each([0, 65536, 1.5, '443'])('rejects port %j', async (port) => {
		expect((await check({ host: '192.168.1.10', port })).length).toBeGreaterThan(0);
	});

	it('rejects unknown properties', async () => {
		expect((await check({ host: '192.168.1.10', extra: 1 })).length).toBeGreaterThan(0);
	});

	it('rejects a request without data', async () => {
		const errors = await validate(plainToInstance(ProtectProbeRequestDto, {}), {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors.length).toBeGreaterThan(0);
	});
});
