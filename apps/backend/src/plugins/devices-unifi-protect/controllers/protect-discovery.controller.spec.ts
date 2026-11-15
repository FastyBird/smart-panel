import { instanceToPlain } from 'class-transformer';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ProtectDiscoveryProbeService, ProtectProbeResult } from '../services/protect-discovery-probe.service';
import {
	ProtectDiscoveryFailureReason,
	ProtectDiscoveryStatus,
	ProtectDiscoveryWarning,
	ProtectInterfaceStatus,
	ProtectPresence,
	ProtectProbeFailure,
	ProtectProbeStatus,
} from '../services/protect-discovery.constants';
import { ProtectDiscoveryScan } from '../services/protect-discovery.service';
import { ProtectDiscoveryService } from '../services/protect-discovery.service';

import { ProtectDiscoveryController } from './protect-discovery.controller';

const systemFixture = readFileSync(join(__dirname, '..', '__fixtures__', 'system.json'), 'utf8');

const consoleProbe = (overrides: Partial<ProtectProbeResult> = {}): ProtectProbeResult => ({
	host: '192.168.1.10',
	port: 443,
	status: ProtectProbeStatus.CONSOLE,
	failure: null,
	protect: ProtectPresence.PRESENT,
	model: 'UNVR',
	name: 'Dream Machine Pro',
	mac: 'aa:bb:cc:dd:ee:ff',
	deviceState: 'ready',
	directConnectDomain: 'abc.id.ui.direct',
	certificate: {
		checked: true,
		domain: 'abc.id.ui.direct',
		valid: true,
		errorCode: null,
		validTo: '2099-01-01T00:00:00.000Z',
		domainResolvesToHost: true,
	},
	preferredHost: 'abc.id.ui.direct',
	...overrides,
});

const scan = (): ProtectDiscoveryScan => ({
	status: ProtectDiscoveryStatus.COMPLETED,
	failureReason: null,
	warnings: [ProtectDiscoveryWarning.NO_REPLIES],
	startedAt: '2026-11-15T10:00:00.000Z',
	finishedAt: '2026-11-15T10:00:05.000Z',
	interfaces: [
		{
			name: 'en0',
			address: '192.168.1.5',
			broadcastAddress: '192.168.1.255',
			status: ProtectInterfaceStatus.OK,
			errorCode: null,
		},
	],
	consoles: [
		{
			mac: 'aa:bb:cc:dd:ee:ff',
			host: '192.168.1.10',
			addresses: ['192.168.1.10'],
			hostname: 'Dream-Machine-Pro',
			model: 'UNVR',
			firmware: '6.0.17',
			directConnectDomain: 'abc.id.ui.direct',
			uuid: 'uuid-1',
			probe: consoleProbe(),
		},
	],
	otherUnifiDevices: 1,
});

const setup = (probe: jest.Mock = jest.fn()) => {
	const discovery = { getLastScan: jest.fn().mockReturnValue(scan()), scan: jest.fn().mockResolvedValue(scan()) };
	const controller = new ProtectDiscoveryController(
		discovery as unknown as ProtectDiscoveryService,
		{ probe } as unknown as ProtectDiscoveryProbeService,
	);

	return { discovery, probe, controller };
};

describe('ProtectDiscoveryController', () => {
	it('wraps the last scan in the response envelope with snake_case wire names', () => {
		const { controller } = setup();

		const data = instanceToPlain(controller.getDiscovery()).data as {
			interfaces: Array<Record<string, unknown>>;
			consoles: Array<
				{ probe: { certificate: Record<string, unknown> } & Record<string, unknown> } & Record<string, unknown>
			>;
		} & Record<string, unknown>;

		expect(data.status).toBe('completed');
		expect(data.other_unifi_devices).toBe(1);
		expect(data.started_at).toBe('2026-11-15T10:00:00.000Z');
		expect(data.interfaces[0].broadcast_address).toBe('192.168.1.255');
		expect(data.consoles[0].direct_connect_domain).toBe('abc.id.ui.direct');
		expect(data.consoles[0].probe.preferred_host).toBe('abc.id.ui.direct');
		expect(data.consoles[0].probe.certificate.domain_resolves_to_host).toBe(true);
		expect(data.warnings).toEqual(['no_replies']);
	});

	it('serialises a failed scan with its reason', () => {
		const { controller, discovery } = setup();

		discovery.getLastScan.mockReturnValue({
			...scan(),
			status: ProtectDiscoveryStatus.FAILED,
			failureReason: ProtectDiscoveryFailureReason.NO_USABLE_INTERFACE,
			consoles: [],
		});

		const data = instanceToPlain(controller.getDiscovery()).data as Record<string, unknown>;

		expect(data.status).toBe('failed');
		expect(data.failure_reason).toBe('no_usable_interface');
	});

	it('runs a scan and returns the finished result', async () => {
		const { controller, discovery } = setup();

		const response = await controller.scanDiscovery();

		expect(discovery.scan).toHaveBeenCalledTimes(1);
		expect((instanceToPlain(response).data as Record<string, unknown>).status).toBe('completed');
	});

	it('probes the requested host and defaults the port to 443', async () => {
		const probe = jest
			.fn()
			.mockResolvedValueOnce(consoleProbe())
			.mockResolvedValueOnce(consoleProbe({ host: 'unifi.local', port: 8443 }));
		const { controller } = setup(probe);

		await controller.probeHost({ data: { host: '192.168.1.10' } });
		await controller.probeHost({ data: { host: 'unifi.local', port: 8443 } });

		expect(probe).toHaveBeenNthCalledWith(1, { host: '192.168.1.10', port: 443 });
		expect(probe).toHaveBeenNthCalledWith(2, { host: 'unifi.local', port: 8443 });
	});

	it('returns an unreachable probe as a normal response', async () => {
		const probe = jest.fn().mockResolvedValue(
			consoleProbe({
				status: ProtectProbeStatus.UNREACHABLE,
				failure: ProtectProbeFailure.TIMEOUT,
				protect: ProtectPresence.UNKNOWN,
				model: null,
				name: null,
				mac: null,
				deviceState: null,
				directConnectDomain: null,
				certificate: null,
				preferredHost: null,
			}),
		);
		const { controller } = setup(probe);

		const response = await controller.probeHost({ data: { host: '192.168.1.10' } });
		const data = instanceToPlain(response).data as Record<string, unknown>;

		expect(data.status).toBe('unreachable');
		expect(data.failure).toBe('timeout');
		expect(data.certificate).toBeNull();
		expect(data.preferred_host).toBeNull();
	});

	it('allows only owners and administrators on all three handlers', () => {
		const proto = ProtectDiscoveryController.prototype;

		for (const handler of [
			// eslint-disable-next-line @typescript-eslint/unbound-method
			proto.getDiscovery,
			// eslint-disable-next-line @typescript-eslint/unbound-method
			proto.scanDiscovery,
			// eslint-disable-next-line @typescript-eslint/unbound-method
			proto.probeHost,
		]) {
			expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});

	it('never serialises request secrets or raw bodies', async () => {
		const { controller } = setup(jest.fn().mockResolvedValue(consoleProbe()));

		const response = await controller.probeHost({ data: { host: '192.168.1.10' } });
		const json = JSON.stringify(instanceToPlain(response)).toLowerCase();

		expect(json).not.toContain('authorization');
		expect(json).not.toContain('x-api-key');
		expect(json).not.toContain(systemFixture.trim().toLowerCase());
	});
});
