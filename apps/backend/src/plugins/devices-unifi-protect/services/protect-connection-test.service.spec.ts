import { ConfigService } from '../../../modules/config/services/config.service';
import { ProtectApiClientFactory } from '../client/protect-api-client.factory';
import { ProtectConsoleSystem } from '../client/protect-api.types';
import { fetchProtectConsoleSystem } from '../client/protect-console-system';
import { ProtectCertificateInfo, inspectProtectCertificate } from '../client/protect-https-agent';
import {
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionMode,
	ProtectTestSavedConnectionDto,
} from '../dto/test-connection.dto';
import { PROTECT_ERROR_MESSAGES, ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectConfigModel, ProtectTlsConfigModel } from '../models/config.model';

import { ProtectConnectionTestService } from './protect-connection-test.service';

jest.mock('../client/protect-https-agent', () => ({ inspectProtectCertificate: jest.fn() }));
jest.mock('../client/protect-console-system', () => ({ fetchProtectConsoleSystem: jest.fn() }));

const inspect = inspectProtectCertificate as jest.MockedFunction<typeof inspectProtectCertificate>;
const fetchSystem = fetchProtectConsoleSystem as jest.MockedFunction<typeof fetchProtectConsoleSystem>;

const STORED_KEY = 'STORED_KEY_aaaaaaaa';
const NEW_KEY = 'NEW_KEY_bbbbbbbb';
const FINGERPRINT = 'ab'.repeat(32);
const OTHER_FINGERPRINT = 'cd'.repeat(32);
const DOMAIN = 'x.id.ui.direct';

const certificate = (overrides: Partial<ProtectCertificateInfo> = {}): ProtectCertificateInfo => ({
	fingerprintSha256: FINGERPRINT,
	subjectCommonName: 'console',
	issuerCommonName: 'console',
	subjectAltNames: [DOMAIN],
	validFrom: '2020-01-01T00:00:00.000Z',
	validTo: '2099-01-01T00:00:00.000Z',
	selfSigned: true,
	trusted: false,
	trustError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
	...overrides,
});

const system = (overrides: Partial<ProtectConsoleSystem> = {}): ProtectConsoleSystem => ({
	name: 'Dream Machine',
	mac: null,
	shortname: 'UDMPRO',
	directConnectDomain: DOMAIN,
	deviceState: 'connected',
	...overrides,
});

interface FakeClient {
	getMetaInfo: jest.Mock;
	getNvr: jest.Mock;
	close: jest.Mock;
}

const candidate = (overrides: Partial<ProtectTestCandidateConnectionDto> = {}): ProtectTestCandidateConnectionDto =>
	Object.assign(new ProtectTestCandidateConnectionDto(), {
		mode: ProtectTestConnectionMode.CANDIDATE,
		host: 'protect.example.com',
		apiKey: NEW_KEY,
		...overrides,
	});

const saved = (): ProtectTestSavedConnectionDto =>
	Object.assign(new ProtectTestSavedConnectionDto(), { mode: ProtectTestConnectionMode.SAVED });

describe('ProtectConnectionTestService', () => {
	let stored: ProtectConfigModel | 'throw';
	let client: FakeClient;
	let factory: { create: jest.Mock };
	let service: ProtectConnectionTestService;

	const storedConfig = (overrides: Partial<ProtectConfigModel> = {}, tls: Partial<ProtectTlsConfigModel> = {}) =>
		Object.assign(new ProtectConfigModel(), {
			host: 'stored.example.com',
			apiKey: STORED_KEY,
			...overrides,
			tls: Object.assign(new ProtectTlsConfigModel(), tls),
		});

	beforeEach(() => {
		stored = storedConfig();
		client = {
			getMetaInfo: jest.fn().mockResolvedValue({ applicationVersion: '7.3.74' }),
			getNvr: jest.fn().mockResolvedValue({ id: 'nvr-1', name: 'Home NVR', modelKey: 'nvr', mac: null, raw: {} }),
			close: jest.fn(),
		};
		factory = { create: jest.fn(() => client) };
		inspect.mockReset().mockResolvedValue(certificate({ trusted: true, selfSigned: false }));
		fetchSystem.mockReset().mockResolvedValue(system());
		service = new ProtectConnectionTestService(
			{
				getPluginConfig: jest.fn(() => {
					if (stored === 'throw') {
						throw new Error('no config');
					}

					return stored;
				}),
			} as unknown as ConfigService,
			factory as unknown as ProtectApiClientFactory,
			'TEST-CA',
		);
	});

	it('never pairs the stored key with a submitted host', async () => {
		const withHost = Object.assign(saved(), { host: 'evil.example.com' });
		const rejected = await service.testConnection(withHost);

		expect(rejected).toMatchObject({
			mode: 'saved',
			success: false,
			errorCategory: 'validation',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.VALIDATION],
		});
		expect(factory.create).not.toHaveBeenCalled();
		expect(inspect).not.toHaveBeenCalled();
		expect(fetchSystem).not.toHaveBeenCalled();

		const accepted = await service.testConnection(candidate({ host: 'evil.example.com' }));

		expect(accepted.success).toBe(true);
		expect(factory.create).toHaveBeenCalledTimes(1);
		expect(factory.create).toHaveBeenCalledWith(expect.objectContaining({ host: 'evil.example.com', apiKey: NEW_KEY }));
		expect(JSON.stringify(factory.create.mock.calls)).not.toContain(STORED_KEY);
		expect(JSON.stringify(accepted)).not.toContain(NEW_KEY);
	});

	it.each([
		['port', { port: 8443 }],
		['api_key', { api_key: 'x' }],
		['tls', { tls: { mode: 'verify' } }],
	])('rejects a saved request carrying the extra field %s', async (_name, extra) => {
		const result = await service.testConnection(Object.assign(saved(), extra));

		expect(result).toMatchObject({ success: false, errorCategory: 'validation' });
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('rejects a candidate with an unknown extra field', async () => {
		const result = await service.testConnection(Object.assign(candidate(), { fingerprint: 'x' }));

		expect(result).toMatchObject({ success: false, errorCategory: 'validation' });
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('requires a key in candidate mode and never falls back to the stored one', async () => {
		const result = await service.testConnection(candidate({ apiKey: '   ' }));

		expect(result).toMatchObject({ success: false, errorCategory: 'validation' });
		expect(inspect).not.toHaveBeenCalled();
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('tests the stored host, port, key and TLS in saved mode', async () => {
		stored = storedConfig({ port: 8443 }, { mode: 'verify', serverName: DOMAIN });

		const result = await service.testConnection(saved());

		expect(result.success).toBe(true);
		expect(inspect).toHaveBeenCalledWith(
			expect.objectContaining({
				host: 'stored.example.com',
				port: 8443,
				serverName: DOMAIN,
				trustedCa: 'TEST-CA',
			}),
		);
		expect(factory.create).toHaveBeenCalledWith({
			host: 'stored.example.com',
			port: 8443,
			apiKey: STORED_KEY,
			tls: { mode: 'verify', serverName: DOMAIN, fingerprintSha256: null },
		});
	});

	it.each([
		['no stored key', () => storedConfig({ apiKey: null })],
		['no stored host', () => storedConfig({ host: null })],
		['a pinned mode without a fingerprint', () => storedConfig({}, { mode: 'pinned' })],
	])('reports validation in saved mode with %s', async (_name, make) => {
		stored = make();

		const result = await service.testConnection(saved());

		expect(result).toMatchObject({ success: false, errorCategory: 'validation', certificate: null });
		expect(inspect).not.toHaveBeenCalled();
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('reports validation in saved mode when the config cannot be read', async () => {
		stored = 'throw';

		await expect(service.testConnection(saved())).resolves.toMatchObject({
			success: false,
			errorCategory: 'validation',
		});
	});

	it('defaults a candidate to port 443 and verify', async () => {
		await service.testConnection(candidate());

		expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ port: 443, serverName: null }));
		expect(factory.create).toHaveBeenCalledWith(
			expect.objectContaining({ port: 443, tls: { mode: 'verify', serverName: null, fingerprintSha256: null } }),
		);
	});

	it('stops before the key is used when verify mode sees an untrusted certificate', async () => {
		inspect.mockResolvedValue(certificate({ trusted: false, selfSigned: true }));

		const result = await service.testConnection(candidate({ host: '10.0.0.2' }));

		expect(result).toMatchObject({
			mode: 'candidate',
			success: false,
			tlsMode: 'verify',
			errorCategory: 'tls_untrusted',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.TLS_UNTRUSTED],
			directConnectDomain: DOMAIN,
			suggestedServerName: DOMAIN,
			consoleName: 'Dream Machine',
			consoleModel: 'UDMPRO',
			certificate: { selfSigned: true, trusted: false, fingerprintSha256: FINGERPRINT },
			applicationVersion: null,
			versionSupported: null,
			nvrName: null,
		});
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('does not adopt the reported domain as the trust anchor', async () => {
		inspect.mockResolvedValue(certificate({ trusted: false }));

		const result = await service.testConnection(candidate({ host: '10.0.0.2' }));

		expect(result.suggestedServerName).toBe(DOMAIN);

		// Only the administrator-supplied name reaches the certificate check; the unauthenticated domain never does.
		expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ serverName: null }));
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('suggests only a valid DNS name', async () => {
		fetchSystem.mockResolvedValue(system({ directConnectDomain: 'not a name!' }));

		const result = await service.testConnection(candidate({ host: '10.0.0.2' }));

		expect(result.directConnectDomain).toBe('not a name!');
		expect(result.suggestedServerName).toBeNull();
	});

	it('pins a console that reports no usable domain by its presented fingerprint', async () => {
		fetchSystem.mockResolvedValue(system({ directConnectDomain: null }));
		inspect.mockResolvedValue(certificate({ trusted: false }));

		const result = await service.testConnection(
			candidate({ host: '10.0.0.2', tls: { mode: 'pinned', fingerprintSha256: FINGERPRINT } }),
		);

		expect(result).toMatchObject({
			success: true,
			tlsMode: 'pinned',
			directConnectDomain: null,
			suggestedServerName: null,
			certificate: { fingerprintSha256: FINGERPRINT, trusted: false },
		});
	});

	it('stops with tls_fingerprint_mismatch before the key is used', async () => {
		inspect.mockResolvedValue(certificate({ trusted: true }));

		const result = await service.testConnection(
			candidate({ tls: { mode: 'pinned', fingerprintSha256: OTHER_FINGERPRINT } }),
		);

		expect(result).toMatchObject({
			success: false,
			errorCategory: 'tls_fingerprint_mismatch',
			certificate: { fingerprintSha256: FINGERPRINT },
		});
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('requires a fingerprint for a pinned candidate', async () => {
		const result = await service.testConnection(candidate({ tls: { mode: 'pinned' } }));

		expect(result).toMatchObject({ success: false, errorCategory: 'validation' });
		expect(inspect).not.toHaveBeenCalled();
	});

	it('reports the console data even when the unauthenticated system read fails', async () => {
		fetchSystem.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'system'));

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({
			success: true,
			directConnectDomain: null,
			suggestedServerName: null,
			consoleName: null,
			consoleModel: null,
		});
	});

	it('reports the certificate failure category when the console cannot be inspected', async () => {
		inspect.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.UNREACHABLE, 'tls'));

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({
			success: false,
			errorCategory: 'unreachable',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.UNREACHABLE],
			certificate: null,
		});
		expect(factory.create).not.toHaveBeenCalled();
	});

	it('succeeds with the version and NVR name when everything checks out', async () => {
		const result = await service.testConnection(candidate({ tls: { mode: 'verify', serverName: DOMAIN } }));

		expect(result).toMatchObject({
			mode: 'candidate',
			success: true,
			tlsMode: 'verify',
			applicationVersion: '7.3.74',
			minimumVersion: '7.2.105',
			versionSupported: true,
			nvrName: 'Home NVR',
			warnings: [],
			errorCategory: null,
			error: null,
			certificate: { trusted: true },
		});
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('reports version_unsupported with the observed version and skips the NVR read', async () => {
		client.getMetaInfo.mockResolvedValue({ applicationVersion: '7.2.104' });

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({
			success: false,
			errorCategory: 'version_unsupported',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.VERSION_UNSUPPORTED],
			applicationVersion: '7.2.104',
			versionSupported: false,
			nvrName: null,
		});
		expect(client.getNvr).not.toHaveBeenCalled();
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it.each([
		['authentication', ProtectErrorCategory.AUTHENTICATION],
		['authorization', ProtectErrorCategory.AUTHORIZATION],
		['rate_limited', ProtectErrorCategory.RATE_LIMITED],
	])('maps a %s failure of the key to its fixed text', async (_name, category) => {
		client.getMetaInfo.mockRejectedValue(new ProtectApiError(category, 'meta/info'));

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({
			success: false,
			errorCategory: category,
			error: PROTECT_ERROR_MESSAGES[category],
			versionSupported: null,
		});
	});

	it('closes the client even when a call fails', async () => {
		client.getNvr.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'nvrs'));

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({
			success: false,
			errorCategory: 'timeout',
			applicationVersion: '7.3.74',
			versionSupported: true,
			nvrName: null,
		});
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('maps an unexpected error to an unavailable failure without leaking its message', async () => {
		client.getMetaInfo.mockRejectedValue(new Error(`boom with ${NEW_KEY} and https://10.0.0.2/secret`));

		const result = await service.testConnection(candidate());

		expect(result).toMatchObject({ success: false, errorCategory: 'unavailable' });
		expect(JSON.stringify(result)).not.toContain(NEW_KEY);
		expect(JSON.stringify(result)).not.toContain('10.0.0.2');
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('survives a factory that throws', async () => {
		factory.create.mockImplementation(() => {
			throw new Error('factory exploded');
		});

		await expect(service.testConnection(candidate())).resolves.toMatchObject({
			success: false,
			errorCategory: 'unavailable',
		});
	});

	it('warns, with a fixed text, about a certificate outside its validity period', async () => {
		inspect.mockResolvedValue(certificate({ trusted: true, validTo: '2001-01-01T00:00:00.000Z' }));

		const result = await service.testConnection(candidate());

		expect(result.success).toBe(true);
		expect(result.warnings).toEqual(['The console certificate is outside its validity period']);
	});
});
