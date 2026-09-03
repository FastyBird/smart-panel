import { Test, TestingModule } from '@nestjs/testing';

import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';

import { TailscaleCliService, TailscaleServeStatus, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleServeService } from './tailscale-serve.service';

const PORT = 3000;
const DNS_NAME = 'panel.tailc0ffee.ts.net';
const HOST_PORT = `${DNS_NAME}:443`;
const TARGET_URL = `http://127.0.0.1:${PORT}`;

// An unrelated node's handler — a different host, same port. Never created,
// read or removed by this plugin; every drift test below proves it.
const UNRELATED_HOST_PORT = 'other-node.tailc0ffee.ts.net:443';
// This plugin's own host, but a stale/manually configured handler on a
// different port — also never this plugin's concern.
const UNRELATED_PORT = '8443';

const NO_CONFIG: TailscaleServeStatus = {};

const OUR_PRIVATE_CONFIG: TailscaleServeStatus = {
	TCP: { '443': { HTTPS: true } },
	Web: { [HOST_PORT]: { Handlers: { '/': { Proxy: TARGET_URL } } } },
	AllowFunnel: {},
};

const OUR_PUBLIC_CONFIG: TailscaleServeStatus = {
	TCP: { '443': { HTTPS: true } },
	Web: { [HOST_PORT]: { Handlers: { '/': { Proxy: TARGET_URL } } } },
	AllowFunnel: { [HOST_PORT]: true },
};

const UNRELATED_HOST_CONFIG: TailscaleServeStatus = {
	TCP: { '443': { HTTPS: true } },
	Web: { [UNRELATED_HOST_PORT]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:9000' } } } },
	AllowFunnel: {},
};

const UNRELATED_PORT_CONFIG: TailscaleServeStatus = {
	TCP: { [UNRELATED_PORT]: { HTTPS: true } },
	Web: { [`${DNS_NAME}:${UNRELATED_PORT}`]: { Handlers: { '/': { Proxy: TARGET_URL } } } },
	AllowFunnel: {},
};

/** Our own private handler plus a second, unrelated host's handler — proves disabling/creating ours never touches the other one. */
const OURS_PRIVATE_PLUS_UNRELATED: TailscaleServeStatus = {
	TCP: OUR_PRIVATE_CONFIG.TCP,
	Web: { ...OUR_PRIVATE_CONFIG.Web, ...UNRELATED_HOST_CONFIG.Web },
	AllowFunnel: {},
};

/** After removing our handler — the unrelated one is still there, exactly as `serve ... off` (never `serve reset`) would leave it. */
const UNRELATED_ONLY: TailscaleServeStatus = UNRELATED_HOST_CONFIG;

/** Our handler is private, but an unrelated host:port happens to have Funnel allowed — must never leak into our own funnel-active read. */
const OUR_PRIVATE_WITH_UNRELATED_FUNNEL: TailscaleServeStatus = {
	TCP: OUR_PRIVATE_CONFIG.TCP,
	Web: OUR_PRIVATE_CONFIG.Web,
	AllowFunnel: { [UNRELATED_HOST_PORT]: true },
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
			DNSName: `${DNS_NAME}.`,
			CapMap: capMap,
		},
		...overrides,
	};
}

describe('TailscaleServeService', () => {
	let service: TailscaleServeService;
	let cli: {
		serve: jest.Mock;
		serveOff: jest.Mock;
		serveStatus: jest.Mock;
		serveReset: jest.Mock;
		funnelOn: jest.Mock;
	};

	beforeEach(async () => {
		cli = {
			serve: jest.fn().mockResolvedValue(undefined),
			serveOff: jest.fn().mockResolvedValue(undefined),
			serveStatus: jest.fn().mockResolvedValue(NO_CONFIG),
			serveReset: jest.fn().mockResolvedValue(undefined),
			funnelOn: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [TailscaleServeService, { provide: TailscaleCliService, useValue: cli }],
		}).compile();

		service = module.get<TailscaleServeService>(TailscaleServeService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('apply — enabling private (serve), https capability present', () => {
		it('creates the handler with serve() when nothing is currently configured', async () => {
			cli.serveStatus.mockResolvedValueOnce(NO_CONFIG).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(cli.serveReset).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([
				{ url: `https://${DNS_NAME}`, scope: 'private', https: true, label: 'Tailscale (HTTPS)' },
			]);
			expect(result.proxyAddresses).toEqual(['127.0.0.1', '::1']);
		});

		it('is idempotent — does not re-run serve() when already private', async () => {
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https']);
			await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
		});

		it('downgrades from public to private using serve() only — there is no "funnel off" command', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PUBLIC_CONFIG).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
		});
	});

	describe('apply — enabling public (funnel), capabilities present', () => {
		it('upgrades from private to public with funnelOn()', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PRIVATE_CONFIG).mockResolvedValueOnce(OUR_PUBLIC_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(cli.funnelOn).toHaveBeenCalledWith(PORT);
			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([
				{ url: `https://${DNS_NAME}`, scope: 'public', https: true, label: 'Tailscale (Funnel)' },
			]);
		});

		it('creates the handler directly as public with funnelOn() when nothing is currently configured', async () => {
			cli.serveStatus.mockResolvedValueOnce(NO_CONFIG).mockResolvedValueOnce(OUR_PUBLIC_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			await service.apply(config, PORT, status);

			expect(cli.funnelOn).toHaveBeenCalledWith(PORT);
			expect(cli.serve).not.toHaveBeenCalled();
		});

		it('is idempotent — does not re-run funnelOn() when already public', async () => {
			cli.serveStatus.mockResolvedValue(OUR_PUBLIC_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			await service.apply(config, PORT, status);

			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serve).not.toHaveBeenCalled();
		});
	});

	describe('apply — disabling (off)', () => {
		it('removes the handler with serveOff(), never serveReset(), when currently private', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PRIVATE_CONFIG).mockResolvedValueOnce(NO_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(cli.serveOff).toHaveBeenCalledTimes(1);
			expect(cli.serveOff).toHaveBeenCalledWith();
			expect(cli.serveReset).not.toHaveBeenCalled();
			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([]);
		});

		it('removes the handler with serveOff(), never serveReset(), when currently public', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PUBLIC_CONFIG).mockResolvedValueOnce(NO_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https', 'funnel']);
			await service.apply(config, PORT, status);

			expect(cli.serveOff).toHaveBeenCalledTimes(1);
			expect(cli.serveReset).not.toHaveBeenCalled();
		});

		it('does nothing when already off', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps([]);
			await service.apply(config, PORT, status);

			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveReset).not.toHaveBeenCalled();
		});

		it('resets an existing handler once the https capability is revoked (self-healing), still via serveOff() not serveReset()', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PRIVATE_CONFIG).mockResolvedValueOnce(NO_CONFIG);

			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serveOff).toHaveBeenCalledTimes(1);
			expect(cli.serveReset).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([]);
		});

		it('disabling never touches an unrelated handler — the read-back after serveOff() still reports it untouched', async () => {
			cli.serveStatus.mockResolvedValueOnce(OURS_PRIVATE_PLUS_UNRELATED).mockResolvedValueOnce(UNRELATED_ONLY);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(cli.serveOff).toHaveBeenCalledTimes(1);
			expect(cli.serveReset).not.toHaveBeenCalled();
			// Our own handler reads back as gone — and the still-present
			// unrelated entry in that same read-back is not mistaken for ours.
			expect(result.endpoints).toEqual([]);
			expect(result.proxyAddresses).toEqual([]);

			const [, secondCallResult] = cli.serveStatus.mock.results;
			await expect(secondCallResult.value as Promise<TailscaleServeStatus>).resolves.toEqual(UNRELATED_ONLY);
		});
	});

	describe('apply — drift: unrelated entries never look like our own handler', () => {
		it('an unrelated host on the same port is never read as our handler being active', async () => {
			cli.serveStatus.mockResolvedValue(UNRELATED_HOST_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps([]);
			await service.apply(config, PORT, status);

			// Desired is "off" and the (correctly scoped) current read is also
			// "off" — no command is issued at all. A pre-fix, unscoped
			// isServeActive() would have seen the unrelated Web entry, read
			// current as "private", and wrongly called serveOff() here.
			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.serveReset).not.toHaveBeenCalled();
		});

		it('an unrelated port on our own host is never read as our handler being active', async () => {
			cli.serveStatus.mockResolvedValue(UNRELATED_PORT_CONFIG);

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps([]);
			await service.apply(config, PORT, status);

			expect(cli.serveOff).not.toHaveBeenCalled();
		});

		it('a Web entry proxying to a different port is not treated as active, even for our own host:443', async () => {
			const wrongTarget: TailscaleServeStatus = {
				TCP: { '443': { HTTPS: true } },
				Web: { [HOST_PORT]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:9999' } } } },
				AllowFunnel: {},
			};
			cli.serveStatus.mockResolvedValueOnce(wrongTarget).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https']);
			await service.apply(defaultConfig(), PORT, status);

			// Desired is "private" and current reads as "off" (wrong target
			// port), so serve() still runs to converge on the right target.
			expect(cli.serve).toHaveBeenCalledWith(PORT);
		});

		it('a matching Web handler without the TCP HTTPS entry is not treated as active', async () => {
			const noTcp: TailscaleServeStatus = {
				Web: { [HOST_PORT]: { Handlers: { '/': { Proxy: TARGET_URL } } } },
				AllowFunnel: {},
			};
			cli.serveStatus.mockResolvedValueOnce(noTcp).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https']);
			await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
		});

		it("an unrelated host:port's AllowFunnel entry never makes our own private handler read as public", async () => {
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_WITH_UNRELATED_FUNNEL);

			// funnel: false — we want private only.
			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(defaultConfig(), PORT, status);

			// Correctly scoped: current reads as "private" (matches desired),
			// so nothing is called. An unscoped isFunnelActive() would have
			// seen the unrelated AllowFunnel[true] entry, read current as
			// "public", and wrongly downgraded via serve().
			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'public-exposure' }));
		});
	});

	describe('apply — capability missing', () => {
		it('never calls serve() or funnelOn() when the https capability is missing, even though serve_https is true', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);

			const status = statusWithCaps([]);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serve).not.toHaveBeenCalled();
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(result.endpoints).toEqual([]);
			expect(result.proxyAddresses).toEqual([]);
		});

		it('serves privately (never funnelOn) when funnel is wanted but the funnel capability is missing', async () => {
			cli.serveStatus.mockResolvedValueOnce(NO_CONFIG).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
		});

		it('downgrades an existing public handler to private once the funnel capability is revoked (self-healing)', async () => {
			cli.serveStatus.mockResolvedValueOnce(OUR_PUBLIC_CONFIG).mockResolvedValueOnce(OUR_PRIVATE_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https']);
			await service.apply(config, PORT, status);

			expect(cli.serve).toHaveBeenCalledWith(PORT);
			expect(cli.funnelOn).not.toHaveBeenCalled();
			expect(cli.serveOff).not.toHaveBeenCalled();
		});
	});

	describe('apply — endpoints without a DNS name', () => {
		it('applies nothing and publishes no endpoint when Self.DNSName is absent', async () => {
			const status = statusWithCaps(['https'], { Self: { Online: true, CapMap: { https: null } } });
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(cli.serveStatus).not.toHaveBeenCalled();
			expect(cli.serve).not.toHaveBeenCalled();
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
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_CONFIG);

			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.advisories).not.toContainEqual(expect.objectContaining({ code: 'tailnet-https-disabled' }));
		});

		it('adds funnel-not-allowed when funnel is wanted but the funnel capability is missing', async () => {
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_CONFIG);

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
			cli.serveStatus.mockResolvedValue(OUR_PUBLIC_CONFIG);

			const config = defaultConfig();
			config.funnel = true;

			const status = statusWithCaps(['https', 'funnel']);
			const result = await service.apply(config, PORT, status);

			expect(result.advisories).toContainEqual(
				expect.objectContaining({ code: 'public-exposure', severity: 'warning' }),
			);
		});

		it('does not add public-exposure when funnel reads back inactive despite being wanted (e.g. the CLI call failed)', async () => {
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_CONFIG);
			cli.funnelOn.mockRejectedValue(new Error('boom'));

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

		it('never throws when the mutating serve() call fails, and reports the pre-attempt (inactive) state', async () => {
			cli.serveStatus.mockResolvedValue(NO_CONFIG);
			cli.serve.mockRejectedValue(new Error('boom'));

			const status = statusWithCaps(['https']);
			const result = await service.apply(defaultConfig(), PORT, status);

			expect(result.endpoints).toEqual([]);
		});

		it('never throws when the mutating serveOff() call fails, and reports the pre-attempt (active) state', async () => {
			cli.serveStatus.mockResolvedValue(OUR_PRIVATE_CONFIG);
			cli.serveOff.mockRejectedValue(new Error('boom'));

			const config = defaultConfig();
			config.serveHttps = false;

			const status = statusWithCaps(['https']);
			const result = await service.apply(config, PORT, status);

			expect(result.endpoints[0]).toMatchObject({ scope: 'private' });
		});
	});
});
