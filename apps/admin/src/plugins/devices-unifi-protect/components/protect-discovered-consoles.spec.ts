import { reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import {
	DevicesUnifiProtectPluginDiscoveryStatus,
	DevicesUnifiProtectPluginProbeProtect,
	DevicesUnifiProtectPluginProbeStatus,
} from '../../../openapi.constants';
import { ProtectScanStillRunningException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';
import { protectProbeKey } from '../store/protect-discovery.store';
import type { IProtectDiscovery, IProtectProbe } from '../store/protect.types';

import ProtectDiscoveredConsoles from './protect-discovered-consoles.vue';

interface IDiscoveryStoreMock {
	discovery: IProtectDiscovery | null;
	probes: Record<string, IProtectProbe>;
	scanning: boolean;
	probing: string[];
	isProbing: (host: string, port?: number) => boolean;
	fetch: ReturnType<typeof vi.fn>;
	scan: ReturnType<typeof vi.fn>;
	probe: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({ discoveryStore: null as unknown }));

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return { ...actual, injectStoresManager: () => ({ getStore: () => mocks.discoveryStore }) };
});

const probeOf = (overrides: Partial<IProtectProbe> = {}): IProtectProbe => ({
	host: '192.168.1.30',
	port: 443,
	status: DevicesUnifiProtectPluginProbeStatus.console,
	failure: null,
	protect: DevicesUnifiProtectPluginProbeProtect.present,
	model: 'UDM-Pro',
	name: 'Dream Machine',
	mac: 'aa:bb:cc:dd:ee:ff',
	deviceState: null,
	directConnectDomain: 'abc123.id.ui.direct',
	certificate: {
		checked: true,
		domain: 'abc123.id.ui.direct',
		valid: true,
		errorCode: null,
		validTo: '2027-01-01T00:00:00.000Z',
		domainResolvesToHost: true,
	},
	preferredHost: 'abc123.id.ui.direct',
	...overrides,
});

const discoveryOf = (
	probe: IProtectProbe = probeOf({ protect: DevicesUnifiProtectPluginProbeProtect.unknown, preferredHost: '192.168.1.30' })
): IProtectDiscovery => ({
	status: DevicesUnifiProtectPluginDiscoveryStatus.completed,
	failureReason: null,
	warnings: [],
	startedAt: '2026-11-20T10:00:00.000Z',
	finishedAt: '2026-11-20T10:00:05.000Z',
	interfaces: [],
	consoles: [
		{
			mac: 'aa:bb:cc:dd:ee:ff',
			host: '192.168.1.30',
			addresses: ['192.168.1.30'],
			hostname: 'Dream Machine',
			model: 'UDM-Pro',
			firmware: '4.1.13',
			directConnectDomain: 'abc123.id.ui.direct',
			uuid: null,
			probe,
		},
	],
	otherUnifiDevices: 0,
});

let store: IDiscoveryStoreMock;

const mountConsoles = (props: Record<string, unknown> = {}) =>
	mount(ProtectDiscoveredConsoles, {
		props: { host: null, port: 443, ...props },
	});

describe('ProtectDiscoveredConsoles', () => {
	beforeEach(() => {
		store = reactive<IDiscoveryStoreMock>({
			discovery: null,
			probes: {},
			scanning: false,
			probing: [],
			isProbing: (host: string, port?: number) => store.probing.includes(protectProbeKey(host, port)),
			fetch: vi.fn(async () => {
				store.discovery = discoveryOf();

				return store.discovery;
			}),
			scan: vi.fn(),
			probe: vi.fn(async ({ host, port }: { host: string; port?: number }) => {
				const result = probeOf({ host, port: port ?? 443 });

				store.probes = { ...store.probes, [protectProbeKey(result.host, result.port)]: result };

				return result;
			}),
		});
		mocks.discoveryStore = store;
	});

	it('shows the cached discovery on mount with name, model, host and firmware', async () => {
		const wrapper = mountConsoles();

		await flushPromises();

		expect(store.fetch).toHaveBeenCalledTimes(1);
		expect(store.scan).not.toHaveBeenCalled();

		const row = wrapper.get('[data-test-id="protect-console"]');

		expect(row.text()).toContain('Dream Machine');
		expect(row.text()).toContain('UDM-Pro');
		expect(row.text()).toContain('192.168.1.30');
		expect(row.text()).toContain('4.1.13');
	});

	it('scans with progress', async () => {
		let finish: (value: IProtectDiscovery) => void = () => undefined;

		store.scan.mockImplementation(
			() =>
				new Promise<IProtectDiscovery>((resolve) => {
					store.scanning = true;
					finish = (value) => {
						store.discovery = value;
						store.scanning = false;
						resolve(value);
					};
				})
		);

		const wrapper = mountConsoles();

		await flushPromises();
		await wrapper.get('[data-test-id="protect-discovery-scan"]').trigger('click');

		expect(store.scan).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="protect-discovery-progress"]').exists()).toBe(true);

		finish(discoveryOf());
		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-discovery-progress"]').exists()).toBe(false);
	});

	it('shows the progress on mount while the backend is scanning, until the scan ends', async () => {
		let finish: () => void = () => undefined;

		store.fetch.mockImplementation(
			() =>
				new Promise<IProtectDiscovery>((resolve) => {
					// What the store holds while it follows a scan started elsewhere.
					store.discovery = { ...discoveryOf(), status: DevicesUnifiProtectPluginDiscoveryStatus.scanning };
					finish = () => {
						store.discovery = discoveryOf();
						resolve(store.discovery);
					};
				})
		);

		const wrapper = mountConsoles();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-discovery-progress"]').exists()).toBe(true);
		expect(wrapper.findAll('[data-test-id="protect-console"]')).toHaveLength(1);

		finish();
		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-discovery-progress"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-discovery-load-failed"]').exists()).toBe(false);
	});

	it('says the scan is still running when the store stops following it', async () => {
		store.scan.mockRejectedValueOnce(new ProtectScanStillRunningException('still running'));

		const wrapper = mountConsoles();

		await flushPromises();
		await wrapper.get('[data-test-id="protect-discovery-scan"]').trigger('click');
		await flushPromises();

		expect(wrapper.get('[data-test-id="protect-discovery-load-failed"]').text()).toContain('devicesUnifiProtectPlugin.discovery.stillScanning');
	});

	it("names the console in each row's check and use buttons", async () => {
		const wrapper = mountConsoles();

		await flushPromises();

		expect(wrapper.get('[data-test-id="protect-console-check"]').attributes('aria-label')).toBe(
			'devicesUnifiProtectPlugin.discovery.checkConsole {"console":"Dream Machine (192.168.1.30)"}'
		);
		expect(wrapper.get('[data-test-id="protect-console-use"]').attributes('aria-label')).toBe(
			'devicesUnifiProtectPlugin.discovery.useConsole {"console":"Dream Machine (192.168.1.30)"}'
		);

		store.discovery = {
			...discoveryOf(probeOf({ name: null })),
			consoles: [{ ...discoveryOf().consoles[0], hostname: null, probe: probeOf({ name: null }) }],
		};
		await flushPromises();

		expect(wrapper.get('[data-test-id="protect-console-use"]').attributes('aria-label')).toBe(
			'devicesUnifiProtectPlugin.discovery.useConsole {"console":"192.168.1.30"}'
		);
	});

	it('checks a console for Protect and its direct connect domain', async () => {
		const wrapper = mountConsoles();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-probe-result"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="protect-console-check"]').trigger('click');
		await flushPromises();

		expect(store.probe).toHaveBeenCalledWith({ host: '192.168.1.30' });

		const result = wrapper.get('[data-test-id="protect-probe-result"]');

		expect(result.text()).toContain('devicesUnifiProtectPlugin.discovery.protect.present');
		expect(result.text()).toContain('devicesUnifiProtectPlugin.discovery.domain.valid');
		expect(result.text()).toContain('abc123.id.ui.direct');
	});

	it("uses a console's preferred host, preferring a newer check over the scan's probe", async () => {
		const wrapper = mountConsoles();

		await flushPromises();
		await wrapper.get('[data-test-id="protect-console-use"]').trigger('click');

		// The port the console was probed on comes along, so a port typed for another console does not stay.
		expect(wrapper.emitted('use')).toEqual([['192.168.1.30', 443]]);

		await wrapper.get('[data-test-id="protect-console-check"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="protect-console-use"]').trigger('click');

		expect(wrapper.emitted('use')?.[1]).toEqual(['abc123.id.ui.direct', 443]);
	});

	it('checks the typed host and offers its preferred host', async () => {
		const wrapper = mountConsoles({ host: ' 192.168.1.40 ', port: 7443 });

		await flushPromises();
		await wrapper.get('[data-test-id="protect-check-host"]').trigger('click');
		await flushPromises();

		expect(store.probe).toHaveBeenCalledWith({ host: '192.168.1.40', port: 7443 });

		const result = wrapper.get('[data-test-id="protect-host-probe"]');

		expect(result.text()).toContain('devicesUnifiProtectPlugin.discovery.protect.present');

		await result.get('[data-test-id="protect-host-probe-use"]').trigger('click');

		expect(wrapper.emitted('use')).toEqual([['abc123.id.ui.direct', 7443]]);
	});

	it('disables the host check without a valid host and reports a probe that timed out', async () => {
		const wrapper = mountConsoles({ host: 'https://unifi.local' });

		await flushPromises();

		expect(wrapper.get('[data-test-id="protect-check-host"]').attributes('disabled')).toBeDefined();

		store.probe.mockRejectedValueOnce(new ProtectTimeoutException('late'));

		await wrapper.setProps({ host: 'unifi.local' });
		await wrapper.get('[data-test-id="protect-check-host"]').trigger('click');
		await flushPromises();

		expect(wrapper.get('[data-test-id="protect-host-probe-error"]').text()).toBe('devicesUnifiProtectPlugin.discovery.probeTimeout');
	});
});
