import { Test, TestingModule } from '@nestjs/testing';

import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';

import { TailscaleCliService, TailscaleServeStatus, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleServeService } from './tailscale-serve.service';

const PORT = 3000;

const NO_CONFIG: TailscaleServeStatus = {};

const SERVE_CONFIG: TailscaleServeStatus = {
	TCP: { '443': { HTTPS: true } },
	Web: { 'panel.tailc0ffee.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:3000' } } } },
	AllowFunnel: {},
};

const FUNNEL_ON: TailscaleServeStatus = {
	AllowFunnel: { 'panel.tailc0ffee.ts.net:443': true },
};

const FUNNEL_OFF: TailscaleServeStatus = {
	AllowFunnel: { 'panel.tailc0ffee.ts.net:443': false },
};

function defaultConfig(): RemoteAccessTailscalePluginConfigModel {
	const config = new RemoteAccessTailscalePluginConfigModel();
	config.serveHttps = true;
	config.funnel = false;

	return config;
}

function statusWithCaps(caps: string[], overrides: Partial<TailscaleStatus> = {}): TailscaleStatus {
	const capMap: Record<string, unknown> = {};

	for (const cap of caps) {
		capMap[cap] = null;
	}

	return {
		BackendState: 'Running',
		Self: {
			Online: true,
			DNSName: 'panel.tailc0ffee.ts.net.',
			CapMap: capMap,
		},
		...overrides,
	};
}

describe('TailscaleServeService', () => {
	let service: TailscaleServeService;
	let cli: {
		serve: jest.Mock;
		serveStatus: jest.Mock;
		serveReset: jest.Mock;
		funnel: jest.Mock;
		funnelStatus: jest.Mock;
	};

	beforeEach(async () => {
		cli = {
			serve: jest.fn().mockResolvedValue(undefined),
			serveStatus: jest.fn().mockResolvedValue(NO_CONFIG),
			serveReset: jest.fn().mockResolvedValue(undefined),
			funnel: jest.fn().mockResolvedValue(undefined),
			funnelStatus: jest.fn().mockResolvedValue(NO_CONFIG),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [TailscaleServeService, { provide: TailscaleCliService, useValue: cli }],
		}).compile();

		service = module.get<TailscaleServeService>(TailscaleServeService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('apply — serve, capability present', () => {
		it('enables Serve when serve_https is wanted, the https capability is present, and nothing is currently served', async () => {
			cli.serveStatus.mockResolvedValueOnce(NO_CONFIG).mockResolvedValueOnce(SERVE_CONFIG);

			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
			expect(cli.serveReset).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([
				{ url: 'https://panel.tailc0ffee.ts.net', scope: 'private', https: true, label: 'Tailscale (HTTPS)' },
			]);
			expect(result.proxyAddresses).toEqual(['127.0.0.1', '::1']);
		});

		it('is idempotent — does not re-run serve when it is already active', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);

			const status = statusWithCaps(['https']);
			await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.serveReset).not.toHaveBeenCalled();
		});
	});

	describe('apply — serve, capability missing', () => {
		it('never calls serve when the https capability is missing, even though serve_https is true', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);

			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([]);
			expect(result.proxyAddresses).toEqual([]);
		});

		it('resets an existing serve config once the https capability is revoked (self-healing)', async () => {
			cli.serveStatus.mockResolvedValueOnce(SERVE_CONFIG).mockResolvedValueOnce(NO_CONFIG);

			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serveReset).toHaveBeenCalledTimes(1);
			expect(cli.serve).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([]);
		});
	});

	describe('apply — serve_https disabled', () => {
		it('runs serve reset when a serve config currently exists', async () => {
			cli.serveStatus.mockResolvedValueOnce(SERVE_CONFIG).mockResolvedValueOnce(NO_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https']);
			await service.apply(config, PORT, status);

			expect(cli.serveReset).toHaveBeenCalledTimes(1);
			expect(cli.serve).not.toHaveBeenCalled();
		});

		it('does not run serve reset when nothing is currently served', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https']);
			await service.apply(config, PORT, status);

			expect(cli.serveReset).not.toHaveBeenCalled();
		});
	});

	describe('apply — funnel, capability present', () => {
		it('turns funnel on when wanted, the capability is present, and it is currently off', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValueOnce(FUNNEL_OFF).mockResolvedValueOnce(FUNNEL_ON);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(cli.funnel).toHaveBeenCalledWith('on');
			expect(result.endpoints).toEqual([
				{ url: 'https://panel.tailc0ffee.ts.net', scope: 'public', https: true, label: 'Tailscale (Funnel)' },
			]);
		});

		it('is idempotent — does not re-run funnel on when it is already on', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValue(FUNNEL_ON);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			await service.apply(config, PORT, status);

			expect(cli.funnel).not.toHaveBeenCalled();
		});

		it('turns funnel off when no longer wanted and it is currently on', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValueOnce(FUNNEL_ON).mockResolvedValueOnce(FUNNEL_OFF);

			const config = defaultConfig();
			config.funnel = false;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(cli.funnel).toHaveBeenCalledWith('off');
			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
		});

		it('does not call funnel off when it is already off', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValue(FUNNEL_OFF);

			const status = statusWithCaps(['https', 'funnel']);
			await service.apply(defaultConfig(), PORT, status);

			expect(cli.funnel).not.toHaveBeenCalled();
		});
	});

	describe('apply — funnel, capability missing', () => {
		it('never calls funnel on when the capability is missing, even though funnel is wanted', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValue(FUNNEL_OFF);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(cli.funnel).not.toHaveBeenCalled();
			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
		});

		it('turns an existing funnel off once the capability is revoked (self-healing)', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValueOnce(FUNNEL_ON).mockResolvedValueOnce(FUNNEL_OFF);

			const status = statusWithCaps(['https']);
			await service.apply(defaultConfig(), PORT, status);

			expect(cli.funnel).toHaveBeenCalledWith('off');
		});
	});

	describe('apply — endpoints without a DNS name', () => {
		it('publishes no endpoint when Serve is active but Self.DNSName is absent', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);

			const status = statusWithCaps(['https'], { Self: { Online: true, CapMap: { https: null } } });
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.endpoints).toEqual([]);
			expect(result.proxyAddresses).toEqual([]);
		});
	});

	describe('apply — advisories', () => {
		it('adds tailnet-https-disabled when serve_https is wanted but the https capability is missing', async () => {
			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.advisories).toContainEqual(
				expect.objectContaining({ code: 'tailnet-https-disabled', severity: 'warning' }),
			);
		});

		it('does not add tailnet-https-disabled when serve_https is off', async () => {
			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps([]);
			const result = await service.apply(config, PORT, status);

			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'tailnet-https-disabled' }));
		});

		it('does not add tailnet-https-disabled when the https capability is present', async () => {
			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'tailnet-https-disabled' }));
		});

		it('adds funnel-not-allowed when funnel is wanted but the funnel capability is missing', async () => {
			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(result.advisories).toContainEqual(
				expect.objectContaining({ code: 'funnel-not-allowed', severity: 'warning' }),
			);
		});

		it('does not add funnel-not-allowed when funnel is off', async () => {
			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'funnel-not-allowed' }));
		});

		it('adds public-exposure once funnel reads back active', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValue(FUNNEL_ON);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(result.advisories).toContainEqual(
				expect.objectContaining({ code: 'public-exposure', severity: 'warning' }),
			);
		});

		it('does not add public-exposure when funnel reads back inactive despite being wanted (e.g. the CLI call failed)', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockResolvedValue(FUNNEL_OFF);
			cli.funnel.mockRejectedValue(new Error('boom'));

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'public-exposure' }));
		});
	});

	describe('apply — resilience', () => {
		it('never throws when reading the serve status fails', async () => {
			cli.serveStatus.mockRejectedValue(new Error('daemon down'));

			const status = statusWithCaps(['https']);

			await expect(service.apply(defaultConfig(), PORT, status)).resolves.toEqual({
				endpoints: [],
				proxyAddresses: [],
				advisories: [],
			});
		});

		it('never throws when reading the funnel status fails', async () => {
			cli.serveStatus.mockResolvedValue(SERVE_CONFIG);
			cli.funnelStatus.mockRejectedValue(new Error('daemon down'));

			const status = statusWithCaps(['https']);

			await expect(service.apply(defaultConfig(), PORT, status)).resolves.toMatchObject({
				endpoints: [expect.objectContaining({ scope: 'private' })],
			});
		});

		it('never throws when the mutating serve call fails, and reports the pre-attempt (inactive) state', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);
			cli.serve.mockRejectedValue(new Error('boom'));

			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.endpoints).toEqual([]);
		});
	});
});
