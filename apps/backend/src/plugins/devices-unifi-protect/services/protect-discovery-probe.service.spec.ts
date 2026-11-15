import { readFileSync } from 'fs';
import { join } from 'path';

import { ProtectProbeHttp } from './protect-discovery-probe';
import { ProtectDiscoveryProbeService } from './protect-discovery-probe.service';
import { ProtectProbeTransport } from './protect-discovery-probe.transport';
import { ProtectPresence, ProtectProbeFailure, ProtectProbeStatus } from './protect-discovery.constants';

const body = readFileSync(join(__dirname, '..', '__fixtures__', 'system.json'), 'utf8');
const D = '0cea14000000000000000000000000000000.id.ui.direct';
const system200: ProtectProbeHttp = { ok: true, statusCode: 200, body };
const status = (statusCode: number): ProtectProbeHttp => ({ ok: true, statusCode, body: '' });
const VALID_TO = '2030-01-01T00:00:00.000Z';
const target = { host: '192.168.1.10', port: 443 };

describe('ProtectDiscoveryProbeService', () => {
	let transport: { get: jest.Mock; checkCertificate: jest.Mock; resolveAll: jest.Mock };
	let service: ProtectDiscoveryProbeService;

	const setup = (options: {
		system?: ProtectProbeHttp;
		protect?: ProtectProbeHttp;
		cert?: unknown;
		domainAddrs?: string[];
		hostAddrs?: string[];
	}): void => {
		transport.get.mockImplementation((_t, path: string) =>
			Promise.resolve(path === '/api/system' ? (options.system ?? system200) : (options.protect ?? status(401))),
		);
		transport.checkCertificate.mockResolvedValue(
			options.cert ?? { ok: true, valid: true, errorCode: null, validTo: VALID_TO },
		);
		transport.resolveAll.mockImplementation((name: string) =>
			Promise.resolve(name === D ? (options.domainAddrs ?? ['192.168.1.10']) : (options.hostAddrs ?? [name])),
		);
	};

	beforeEach(() => {
		transport = { get: jest.fn(), checkCertificate: jest.fn(), resolveAll: jest.fn() };
		service = new ProtectDiscoveryProbeService(transport as unknown as ProtectProbeTransport);
	});

	it('queries only the two documented paths with the probe timeout', async () => {
		setup({});
		await service.probe(target);

		expect(transport.get.mock.calls).toHaveLength(2);
		expect(transport.get.mock.calls).toEqual(
			expect.arrayContaining([
				[target, '/api/system', 4000],
				[target, '/proxy/protect/api', 4000],
			]),
		);
	});

	it('prefers the directConnectDomain when its certificate is valid and it resolves to the host', async () => {
		setup({});
		const result = await service.probe(target);

		expect(result).toMatchObject({
			status: ProtectProbeStatus.CONSOLE,
			protect: ProtectPresence.PRESENT,
			preferredHost: D,
		});
		expect(result.certificate).toEqual({
			checked: true,
			domain: D,
			valid: true,
			errorCode: null,
			validTo: VALID_TO,
			domainResolvesToHost: true,
		});
		expect(transport.checkCertificate).toHaveBeenCalledWith(target, D, 4000);
	});

	it('keeps the IP when the certificate is valid but the domain resolves elsewhere', async () => {
		setup({ domainAddrs: ['203.0.113.9'] });
		const result = await service.probe(target);

		expect(result.preferredHost).toBe('192.168.1.10');
		expect(result.certificate?.domainResolvesToHost).toBe(false);
	});

	it('keeps the IP when the domain does not resolve', async () => {
		setup({ domainAddrs: [] });

		expect((await service.probe(target)).preferredHost).toBe('192.168.1.10');
	});

	it('keeps the IP and reports the error code when the certificate is invalid', async () => {
		setup({ cert: { ok: true, valid: false, errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT', validTo: null } });
		const result = await service.probe(target);

		expect(result.preferredHost).toBe('192.168.1.10');
		expect(result.certificate).toMatchObject({ valid: false, errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT', validTo: null });
	});

	it('resolves a hostname target before comparing addresses', async () => {
		setup({ hostAddrs: ['192.168.1.10'] });
		const result = await service.probe({ host: 'unifi.local', port: 443 });

		expect(transport.resolveAll).toHaveBeenCalledWith('unifi.local');
		expect(result.preferredHost).toBe(D);
	});

	it('records a certificate transport failure as valid null', async () => {
		setup({ cert: { ok: false, kind: 'timeout', code: null } });
		const result = await service.probe(target);

		expect(result.certificate).toMatchObject({ checked: true, valid: null, errorCode: 'timeout', validTo: null });
		expect(result.preferredHost).toBe('192.168.1.10');
	});

	it('skips the certificate check when /api/system has no usable domain', async () => {
		setup({ system: { ok: true, statusCode: 200, body: '{"hardware":{"shortname":"UNVR"}}' } });
		const result = await service.probe(target);

		expect(result.status).toBe(ProtectProbeStatus.CONSOLE);
		expect(result.certificate).toBeNull();
		expect(result.preferredHost).toBe('192.168.1.10');
		expect(transport.checkCertificate).not.toHaveBeenCalled();
	});

	it('skips the certificate check when the host is not a console', async () => {
		setup({ system: status(404) });
		const result = await service.probe(target);

		expect(result).toMatchObject({ status: ProtectProbeStatus.NOT_CONSOLE, preferredHost: null, certificate: null });
		expect(result.model).toBeNull();
		expect(transport.checkCertificate).not.toHaveBeenCalled();
	});

	it('returns an unreachable result and never rejects when the transport reports failures', async () => {
		setup({
			system: { ok: false, kind: 'refused', code: 'ECONNREFUSED' },
			protect: { ok: false, kind: 'refused', code: null },
		});

		await expect(service.probe(target)).resolves.toMatchObject({
			host: '192.168.1.10',
			port: 443,
			status: ProtectProbeStatus.UNREACHABLE,
			failure: ProtectProbeFailure.CONNECTION_REFUSED,
			preferredHost: null,
		});
	});

	it('never lets a throwing transport escape', async () => {
		transport.get.mockImplementation(() => {
			throw new Error('boom');
		});

		await expect(service.probe(target)).resolves.toMatchObject({
			status: ProtectProbeStatus.UNREACHABLE,
			failure: ProtectProbeFailure.HOST_UNREACHABLE,
		});
	});
});
