import { Test, TestingModule } from '@nestjs/testing';

import { TailscaleStatus } from './tailscale-cli.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

const PORT = 3000;

describe('TailscaleStatusMapperService', () => {
	let service: TailscaleStatusMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TailscaleStatusMapperService],
		}).compile();

		service = module.get<TailscaleStatusMapperService>(TailscaleStatusMapperService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('map — one fixture per BackendState', () => {
		it('maps NoState to connecting (transient startup state)', () => {
			const result = service.map({ BackendState: 'NoState' }, { port: PORT });

			expect(result.state).toBe('connecting');
			expect(result.endpoints).toEqual([]);
		});

		it('maps NeedsLogin with an AuthURL to pending-auth', () => {
			const result = service.map(
				{ BackendState: 'NeedsLogin', AuthURL: 'https://login.tailscale.com/a/abc123' },
				{ port: PORT },
			);

			expect(result.state).toBe('pending-auth');
		});

		it('maps NeedsLogin without an AuthURL to setup-required', () => {
			const result = service.map({ BackendState: 'NeedsLogin' }, { port: PORT });

			expect(result.state).toBe('setup-required');
			expect(result.message).toBeDefined();
		});

		it('maps NeedsMachineAuth to pending-approval', () => {
			const result = service.map({ BackendState: 'NeedsMachineAuth' }, { port: PORT });

			expect(result.state).toBe('pending-approval');
			expect(result.message).toBeDefined();
		});

		it('maps Stopped to disconnected', () => {
			const result = service.map({ BackendState: 'Stopped' }, { port: PORT });

			expect(result.state).toBe('disconnected');
			expect(result.endpoints).toEqual([]);
		});

		it('maps Starting to connecting', () => {
			const result = service.map({ BackendState: 'Starting' }, { port: PORT });

			expect(result.state).toBe('connecting');
		});

		it('maps Running + Self.Online to connected', () => {
			const status: TailscaleStatus = {
				BackendState: 'Running',
				Self: { Online: true, TailscaleIPs: ['100.64.0.5'], DNSName: 'panel.tailc0ffee.ts.net.' },
				CurrentTailnet: { Name: 'example.ts.net', MagicDNSEnabled: false },
			};

			const result = service.map(status, { port: PORT });

			expect(result.state).toBe('connected');
		});

		it('maps Running without Self.Online to connecting (not yet settled)', () => {
			const status: TailscaleStatus = { BackendState: 'Running', Self: { Online: false } };

			const result = service.map(status, { port: PORT });

			expect(result.state).toBe('connecting');
		});

		it('maps InUseOtherUser to error', () => {
			const result = service.map({ BackendState: 'InUseOtherUser' }, { port: PORT });

			expect(result.state).toBe('error');
			expect(result.message).toContain('InUseOtherUser');
		});

		it('maps an unrecognized BackendState to error defensively', () => {
			const result = service.map(
				{ BackendState: 'SomethingFuture' as TailscaleStatus['BackendState'] },
				{ port: PORT },
			);

			expect(result.state).toBe('error');
		});
	});

	describe('map — missing Self', () => {
		it('does not throw and produces no endpoints when Self is absent while Running', () => {
			const result = service.map({ BackendState: 'Running' }, { port: PORT });

			// Self.Online is undefined -> not confirmed online -> connecting, not connected
			expect(result.state).toBe('connecting');
			expect(result.endpoints).toEqual([]);
			expect(result.details.dnsName).toBeNull();
			expect(result.details.ipv4).toBeNull();
		});
	});

	describe('map — endpoints', () => {
		const connectedStatus: TailscaleStatus = {
			BackendState: 'Running',
			Self: {
				Online: true,
				TailscaleIPs: ['100.64.0.5', 'fd7a:115c:a1e0::5'],
				DNSName: 'panel.tailc0ffee.ts.net.',
			},
			CurrentTailnet: { Name: 'example.ts.net', MagicDNSSuffix: 'tailc0ffee.ts.net', MagicDNSEnabled: true },
			Version: '1.78.1',
			Health: [],
		};

		it('publishes the IPv4 endpoint and the MagicDNS endpoint when MagicDNS is enabled', () => {
			const result = service.map(connectedStatus, { port: PORT });

			expect(result.endpoints).toEqual([
				{ url: 'http://100.64.0.5:3000', scope: 'private', https: false, label: 'Tailscale IPv4' },
				{ url: 'http://panel.tailc0ffee.ts.net:3000', scope: 'private', https: false, label: 'Tailscale (MagicDNS)' },
			]);
		});

		it('strips the trailing dot from the DNS name in details too', () => {
			const result = service.map(connectedStatus, { port: PORT });

			expect(result.details.dnsName).toBe('panel.tailc0ffee.ts.net');
		});

		it('omits the MagicDNS endpoint when MagicDNS is disabled', () => {
			const status: TailscaleStatus = {
				...connectedStatus,
				CurrentTailnet: { ...connectedStatus.CurrentTailnet, MagicDNSEnabled: false },
			};

			const result = service.map(status, { port: PORT });

			expect(result.endpoints).toEqual([
				{ url: 'http://100.64.0.5:3000', scope: 'private', https: false, label: 'Tailscale IPv4' },
			]);
		});

		it('omits the MagicDNS endpoint when CurrentTailnet is absent', () => {
			const status: TailscaleStatus = { ...connectedStatus, CurrentTailnet: undefined };

			const result = service.map(status, { port: PORT });

			expect(result.endpoints).toHaveLength(1);
		});

		it('publishes no endpoints outside the connected state, even with a full Self payload', () => {
			const result = service.map({ ...connectedStatus, BackendState: 'Starting' }, { port: PORT });

			expect(result.endpoints).toEqual([]);
		});
	});

	describe('map — details', () => {
		it('exposes tailnet, dnsName, ipv4, ipv6, version, healthWarnings, keyExpiresAt, httpsCapable, funnelCapable and certDomains', () => {
			const status: TailscaleStatus = {
				BackendState: 'Running',
				Self: {
					Online: true,
					TailscaleIPs: ['100.64.0.5', 'fd7a:115c:a1e0::5'],
					DNSName: 'panel.tailc0ffee.ts.net.',
					KeyExpiry: '2026-10-01T00:00:00Z',
					CapMap: { https: null, funnel: null },
				},
				CurrentTailnet: { Name: 'example.ts.net', MagicDNSEnabled: true },
				Version: '1.78.1',
				Health: ['unreachable via relay'],
				CertDomains: ['panel.tailc0ffee.ts.net'],
			};

			const result = service.map(status, { port: PORT });

			expect(result.details).toEqual({
				tailnet: 'example.ts.net',
				dnsName: 'panel.tailc0ffee.ts.net',
				ipv4: '100.64.0.5',
				ipv6: 'fd7a:115c:a1e0::5',
				version: '1.78.1',
				healthWarnings: 'unreachable via relay',
				keyExpiresAt: '2026-10-01T00:00:00Z',
				httpsCapable: true,
				funnelCapable: true,
				certDomains: 'panel.tailc0ffee.ts.net',
			});
		});

		it('fills every detail with null/false when the status is nearly empty', () => {
			const result = service.map({ BackendState: 'NoState' }, { port: PORT });

			expect(result.details).toEqual({
				tailnet: null,
				dnsName: null,
				ipv4: null,
				ipv6: null,
				version: null,
				healthWarnings: null,
				keyExpiresAt: null,
				httpsCapable: false,
				funnelCapable: false,
				certDomains: null,
			});
		});

		it('reports httpsCapable/funnelCapable independently based on which CapMap keys are present', () => {
			const result = service.map(
				{ BackendState: 'Running', Self: { Online: true, CapMap: { https: null } } },
				{ port: PORT },
			);

			expect(result.details.httpsCapable).toBe(true);
			expect(result.details.funnelCapable).toBe(false);
		});

		it('joins multiple CertDomains into a single comma-separated string', () => {
			const result = service.map(
				{ BackendState: 'Running', Self: { Online: true }, CertDomains: ['a.ts.net', 'b.ts.net'] },
				{ port: PORT },
			);

			expect(result.details.certDomains).toBe('a.ts.net, b.ts.net');
		});
	});

	describe('map — proxyAddresses', () => {
		it('is always empty — Serve is not implemented in this plugin core', () => {
			const status: TailscaleStatus = { BackendState: 'Running', Self: { Online: true } };

			const result = service.map(status, { port: PORT });

			expect(result.proxyAddresses).toEqual([]);
		});
	});

	describe('hasExistingKey', () => {
		it.each<[TailscaleStatus['BackendState'], boolean]>([
			['NoState', false],
			['NeedsLogin', false],
			['NeedsMachineAuth', true],
			['Stopped', true],
			['Starting', true],
			['Running', true],
			['InUseOtherUser', true],
		])('%s -> holdsKey=%s', (backendState, expected) => {
			expect(service.hasExistingKey({ BackendState: backendState })).toBe(expected);
		});
	});
});
